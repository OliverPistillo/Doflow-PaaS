use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::Rng;
use serde::Deserialize;
use std::{
    net::{IpAddr, SocketAddr},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::Duration,
};
use subtle::ConstantTimeEq;
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_opener::OpenerExt;
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::{TcpListener, TcpStream},
};
use url::Url;

const DESKTOP_GOOGLE_START: &str = "https://api.doflow.it/api/auth/google/desktop/start";
const LOOPBACK_PATH: &str = "/doflow/oauth/callback";

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct StartDesktopGoogleOAuthInput {
    pub schema_version: u8,
    pub profile_id: String,
}

#[derive(Default)]
pub struct OAuthManager {
    in_flight: Arc<AtomicBool>,
}

impl OAuthManager {
    pub async fn start<R: Runtime>(
        &self,
        app: AppHandle<R>,
        webview_label: String,
    ) -> Result<(), String> {
        if self.in_flight.swap(true, Ordering::SeqCst) {
            return Err("A Google sign-in is already in progress".into());
        }

        let listener = match TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, 0)).await {
            Ok(listener) => listener,
            Err(_) => {
                self.in_flight.store(false, Ordering::SeqCst);
                return Err("Unable to reserve the secure local OAuth callback".into());
            }
        };
        let port = listener
            .local_addr()
            .map_err(|_| "Unable to read the local OAuth callback port")?
            .port();
        let mut nonce_bytes = [0_u8; 32];
        rand::rng().fill(&mut nonce_bytes);
        let nonce = URL_SAFE_NO_PAD.encode(nonce_bytes);

        let mut start_url = Url::parse(DESKTOP_GOOGLE_START)
            .map_err(|_| "The fixed Google OAuth endpoint is invalid")?;
        start_url
            .query_pairs_mut()
            .append_pair("callbackPort", &port.to_string())
            .append_pair("state", &nonce);
        if let Err(_error) = app.opener().open_url(start_url.as_str(), None::<&str>) {
            self.in_flight.store(false, Ordering::SeqCst);
            return Err("Unable to open the system browser".into());
        }

        let in_flight = self.in_flight.clone();
        tauri::async_runtime::spawn(async move {
            let result =
                tokio::time::timeout(Duration::from_secs(180), accept_callback(listener, &nonce))
                    .await;
            in_flight.store(false, Ordering::SeqCst);

            let target = match result {
                Ok(Ok(callback)) => callback_target(&callback),
                _ => error_target("google_desktop_timeout"),
            };
            if let Some(window) = app.get_webview_window(&webview_label) {
                let _ = window.navigate(target);
                let _ = window.show();
                let _ = window.set_focus();
            }
        });
        Ok(())
    }
}

#[derive(Debug)]
enum OAuthCallback {
    Success {
        handoff: String,
        tenant: String,
        kind: String,
    },
    Failure {
        code: String,
    },
}

async fn accept_callback(listener: TcpListener, expected_state: &str) -> Result<OAuthCallback, ()> {
    let (mut stream, peer) = listener.accept().await.map_err(|_| ())?;
    if !is_loopback_peer(peer) {
        respond(&mut stream, 403, "Callback non consentita").await;
        return Err(());
    }
    let request_target = read_request_target(&mut stream).await?;
    let callback = parse_callback(&request_target, expected_state)?;
    respond(
        &mut stream,
        200,
        "Accesso completato. Puoi chiudere questa finestra e tornare a Doflow.",
    )
    .await;
    Ok(callback)
}

async fn read_request_target(stream: &mut TcpStream) -> Result<String, ()> {
    let mut buffer = Vec::with_capacity(2048);
    let mut chunk = [0_u8; 1024];
    loop {
        let read = stream.read(&mut chunk).await.map_err(|_| ())?;
        if read == 0 || buffer.len() + read > 8192 {
            return Err(());
        }
        buffer.extend_from_slice(&chunk[..read]);
        if buffer.windows(4).any(|window| window == b"\r\n\r\n") {
            break;
        }
    }
    let text = std::str::from_utf8(&buffer).map_err(|_| ())?;
    let first_line = text.lines().next().ok_or(())?;
    let mut parts = first_line.split_whitespace();
    if parts.next() != Some("GET") {
        return Err(());
    }
    let target = parts.next().ok_or(())?;
    if parts.next() != Some("HTTP/1.1") || target.len() > 4096 {
        return Err(());
    }
    Ok(target.to_owned())
}

fn parse_callback(target: &str, expected_state: &str) -> Result<OAuthCallback, ()> {
    let url = Url::parse(&format!("http://127.0.0.1{target}")).map_err(|_| ())?;
    if url.path() != LOOPBACK_PATH || url.fragment().is_some() {
        return Err(());
    }
    let mut state = None;
    let mut handoff = None;
    let mut tenant = None;
    let mut kind = None;
    let mut error = None;
    for (key, value) in url.query_pairs() {
        match key.as_ref() {
            "state" if state.is_none() => state = Some(value.into_owned()),
            "handoff" if handoff.is_none() => handoff = Some(value.into_owned()),
            "tenant" if tenant.is_none() => tenant = Some(value.into_owned()),
            "kind" if kind.is_none() => kind = Some(value.into_owned()),
            "error" if error.is_none() => error = Some(value.into_owned()),
            _ => return Err(()),
        }
    }
    let state = state.ok_or(())?;
    if state.len() != expected_state.len()
        || state
            .as_bytes()
            .ct_eq(expected_state.as_bytes())
            .unwrap_u8()
            != 1
    {
        return Err(());
    }
    if let Some(code) = error {
        if handoff.is_some() || tenant.is_some() || kind.is_some() {
            return Err(());
        }
        if !matches!(
            code.as_str(),
            "google_no_email" | "google_email_not_verified" | "google_callback_failed"
        ) {
            return Err(());
        }
        return Ok(OAuthCallback::Failure { code });
    }

    let handoff = handoff.ok_or(())?;
    if !(32..=128).contains(&handoff.len())
        || !handoff
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-'))
    {
        return Err(());
    }
    let tenant = tenant.ok_or(())?;
    if tenant.is_empty()
        || tenant.len() > 64
        || !tenant
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-'))
    {
        return Err(());
    }
    let kind = kind.ok_or(())?;
    if !matches!(kind.as_str(), "login" | "signup") {
        return Err(());
    }
    Ok(OAuthCallback::Success {
        handoff,
        tenant,
        kind,
    })
}

fn callback_target(callback: &OAuthCallback) -> Url {
    match callback {
        OAuthCallback::Success {
            handoff,
            tenant,
            kind,
        } => {
            let mut target = if kind == "signup" {
                Url::parse("https://app.doflow.it/register").expect("fixed Doflow URL")
            } else {
                Url::parse("https://app.doflow.it/login").expect("fixed Doflow URL")
            };
            target
                .query_pairs_mut()
                .append_pair("handoff", handoff)
                .append_pair("tenant", tenant);
            target
        }
        OAuthCallback::Failure { code } => error_target(code),
    }
}

fn error_target(code: &str) -> Url {
    let mut target = Url::parse("https://app.doflow.it/login").expect("fixed Doflow URL");
    target.query_pairs_mut().append_pair("error", code);
    target
}

fn is_loopback_peer(peer: SocketAddr) -> bool {
    match peer.ip() {
        IpAddr::V4(address) => address.is_loopback(),
        IpAddr::V6(address) => address.is_loopback(),
    }
}

async fn respond(stream: &mut TcpStream, status: u16, message: &str) {
    let body = format!(
        "<!doctype html><meta charset=utf-8><meta http-equiv=Content-Security-Policy content=\"default-src 'none'; style-src 'unsafe-inline'\"><title>Doflow</title><style>body{{background:#05070e;color:#eef0ff;font:16px system-ui;display:grid;place-items:center;min-height:100vh;margin:0}}main{{text-align:center;max-width:36rem;padding:2rem}}h1{{font-size:1.5rem}}p{{color:#a5acc6}}</style><main><h1>Doflow</h1><p>{message}</p></main>"
    );
    let reason = if status == 200 { "OK" } else { "Forbidden" };
    let response = format!(
        "HTTP/1.1 {status} {reason}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\nReferrer-Policy: no-referrer\r\n\r\n{body}",
        body.len()
    );
    let _ = stream.write_all(response.as_bytes()).await;
    let _ = stream.shutdown().await;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loopback_callback_rejects_wrong_state_path_and_arbitrary_parameters() {
        let handoff = "a".repeat(43);
        let valid =
            format!("{LOOPBACK_PATH}?state=expected&handoff={handoff}&tenant=doflow&kind=login");
        assert!(parse_callback(&valid, "expected").is_ok());
        assert!(parse_callback(&valid.replace("expected", "wrong"), "expected").is_err());
        assert!(parse_callback(&valid.replace(LOOPBACK_PATH, "/other"), "expected").is_err());
        assert!(parse_callback(&format!("{valid}&url=https://evil.invalid"), "expected").is_err());
        let failure = format!("{LOOPBACK_PATH}?state=expected&error=google_callback_failed");
        assert!(matches!(
            parse_callback(&failure, "expected"),
            Ok(OAuthCallback::Failure { .. })
        ));
        assert!(parse_callback(&format!("{failure}&tenant=doflow"), "expected").is_err());
    }

    #[test]
    fn loopback_callback_rejects_invalid_handoff_tenant_and_kind() {
        let base = format!(
            "{LOOPBACK_PATH}?state=s&handoff={}&tenant=doflow&kind=login",
            "a".repeat(43)
        );
        assert!(parse_callback(&base.replace(&"a".repeat(43), "short"), "s").is_err());
        assert!(parse_callback(&base.replace("tenant=doflow", "tenant=../escape"), "s").is_err());
        assert!(parse_callback(&base.replace("kind=login", "kind=token"), "s").is_err());
    }

    #[test]
    fn callback_target_is_always_the_fixed_doflow_origin() {
        let target = callback_target(&OAuthCallback::Success {
            handoff: "a".repeat(43),
            tenant: "doflow".into(),
            kind: "login".into(),
        });
        assert_eq!(
            target.origin().ascii_serialization(),
            "https://app.doflow.it"
        );
        assert!(!target.as_str().contains("jwt"));
    }
}
