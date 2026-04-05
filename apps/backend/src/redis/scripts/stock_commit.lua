-- Atomic stock commit: AVAILABLE -> COMMITTED
-- KEYS[1] = available_key
-- KEYS[2] = committed_key
-- ARGV[1] = qty (number)

local available = tonumber(redis.call("GET", KEYS[1]) or "0")
local qty = tonumber(ARGV[1])

if qty <= 0 then
  return { err = "QTY_INVALID" }
end

if available < qty then
  return { err = "INSUFFICIENT_STOCK" }
end

redis.call("DECRBYFLOAT", KEYS[1], qty)
redis.call("INCRBYFLOAT", KEYS[2], qty)

return { "OK", tostring(available - qty) }
