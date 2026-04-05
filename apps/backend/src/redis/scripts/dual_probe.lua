-- KEYS[1]: Filtro Corrente (doflow:bf:current)
-- KEYS[2]: Filtro Precedente (doflow:bf:prev)
-- ARGV[1]: Elemento da verificare/aggiungere
-- ARGV[2]: TTL (Time To Live)

-- 1. Hot Path: Verifica nel filtro corrente
local in_current = redis.call('BF.EXISTS', KEYS[1], ARGV[1])
if in_current == 1 then
    return 1 -- Trovato
end

-- 2. Grace Period: Verifica nel filtro precedente (Cold Start Safe)
local in_prev = redis.call('BF.EXISTS', KEYS[2], ARGV[1])
if in_prev == 1 then
    return 1 -- Trovato nello storico
end

-- 3. Write Path: Aggiunge solo al corrente
redis.call('BF.ADD', KEYS[1], ARGV[1])
redis.call('EXPIRE', KEYS[1], ARGV[2]) -- Rinnovo TTL

return 0 -- Nuovo elemento
