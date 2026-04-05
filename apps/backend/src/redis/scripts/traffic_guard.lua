-- traffic_guard.lua
-- Doflow v3.5 Traffic Control Script
-- Atomicity: Guaranteed by Redis Single Thread Loop

-- KEYS[1] -> Rate Limit Key (es. "df:rl:ip:192.168.1.1")
-- KEYS[2] -> Blacklist Key (es. "df:security:blacklist")
-- KEYS[3] -> Tenant Bloom Filter Key (es. "df:tenants:bloom")

-- ARGV[1] -> Limit (Burst Capacity, es. 100 requests)
-- ARGV[2] -> Rate (Tokens per second, es. 10)
-- ARGV[3] -> Cost (Cost per request, default 1)
-- ARGV[4] -> Current Timestamp (Seconds)
-- ARGV[5] -> Check Type ('IP', 'TENANT', 'GLOBAL')
-- ARGV[6] -> Target Item (es. Tenant Slug for Bloom check)

local rate_limit_key = KEYS[1]
local blacklist_key = KEYS[2]
local bloom_key = KEYS[3]

local burst = tonumber(ARGV[1])
local rate = tonumber(ARGV[2])
local cost = tonumber(ARGV[3])
local now = tonumber(ARGV[4])
local check_type = ARGV[5]
local target_item = ARGV[6]

---------------------------------------------------------
-- 1. SECURITY CHECK (Blacklist)
---------------------------------------------------------
-- Se l'IP o l'identificativo è nella blacklist globale, rifiuta subito.
if redis.call("SISMEMBER", blacklist_key, target_item) == 1 then
    return {-1, 0, "BLOCKED_BY_BLACKLIST"}
end

---------------------------------------------------------
-- 2. EXISTENCE CHECK (Bloom Filter - Optional)
---------------------------------------------------------
-- Se stiamo verificando un Tenant, usiamo il Bloom Filter per evitare DB Hit sui 404.
if bloom_key ~= "" and bloom_key ~= nil then
    -- Placeholder per v3.5: In futuro qui useremo BF.EXISTS se il modulo RedisBloom è attivo.
    -- Per ora passiamo sempre, a meno che non implementiamo una logica bitfield custom.
    -- local exists = redis.call("BF.EXISTS", bloom_key, target_item)
end

---------------------------------------------------------
-- 3. TRAFFIC SHAPING (Token Bucket Algorithm)
---------------------------------------------------------
-- Algoritmo: Token Bucket con Lazy Refill
-- Refill = (delta_time * rate)
-- Tokens = min(capacity, previous_tokens + refill)

local last_refill_time_key = rate_limit_key .. ":ts"
local tokens_key = rate_limit_key .. ":tok"

local last_refill_time = tonumber(redis.call("GET", last_refill_time_key)) or 0
local tokens = tonumber(redis.call("GET", tokens_key)) or burst

-- Calcola refill
if last_refill_time == 0 then
    last_refill_time = now
end

local delta = math.max(0, now - last_refill_time)
local refill = delta * rate
local new_tokens = math.min(burst, tokens + refill)

if new_tokens >= cost then
    -- ALLOW REQUEST
    new_tokens = new_tokens - cost
    redis.call("SET", tokens_key, new_tokens, "EX", 60) -- Scade dopo 60s di inattività
    redis.call("SET", last_refill_time_key, now, "EX", 60)
    
    return {1, new_tokens, "ALLOWED"}
else
    -- DENY REQUEST
    -- Calcola quando riprovare (Retry-After)
    local missing = cost - new_tokens
    local retry_after = missing / rate

    return {0, 0, tostring(retry_after)}
end