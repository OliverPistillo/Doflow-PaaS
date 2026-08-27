const fallbackTimeZone = "Europe/Rome"

function validTimeZone(timeZone?: string) {
  try {
    new Intl.DateTimeFormat("it-IT", { timeZone }).format()
    return timeZone || fallbackTimeZone
  } catch {
    return fallbackTimeZone
  }
}

export function getZonedGreeting(date: Date, timeZone: string | undefined, name: string) {
  const safeTimeZone = validTimeZone(timeZone)
  const hour = Number(new Intl.DateTimeFormat("it-IT", { hour: "2-digit", hourCycle: "h23", timeZone: safeTimeZone }).format(date))
  const greeting = hour >= 5 && hour < 12 ? "Buongiorno" : hour >= 12 && hour < 18 ? "Buon pomeriggio" : "Buonasera"
  const dateLabel = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: safeTimeZone }).format(date)
  return { greeting: `${greeting}, ${name}`, dateLabel, hour, timeZone: safeTimeZone }
}
