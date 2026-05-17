/**
 * poolCalculator.js — Lógica de negocio para calcular la distribución de la polla CFL
 * Todos los montos en USD. No hay números hardcoded en calculatePool().
 */

// ─── Configuración del negocio ───────────────────────────────────────────────
var POOL_CONFIG = {
  // Precio de inscripción por jugador (USD)
  subscriptionPrice: 40,

  // Distribución del pozo total (deben sumar exactamente 1.0)
  distribution: {
    first : 0.30,   // 1er lugar
    second: 0.15,   // 2do lugar
    third : 0.10,   // 3er lugar
    house : 0.45    // Porcentaje de la casa (gastos + ganancia)
  },

  // Costos fijos del operador (USD)
  fixedCosts: {
    software   : 100,  // Licencia / plataforma
    programming: 100   // Desarrollo / mantenimiento
  },

  // Comisiones de Stripe por transacción
  stripe: {
    percentFee: 0.029,  // 2.9% del monto cobrado
    fixedFee  : 0.30    // $0.30 fijo por transacción
  }
};

// ─── Función principal ────────────────────────────────────────────────────────
/**
 * calculatePool(currentPlayers)
 * Calcula el desglose completo del pozo dado el número actual de jugadores pagados.
 *
 * @param {number} currentPlayers — Jugadores con inscripción confirmada (pagada)
 * @returns {object} Desglose completo (ver estructura abajo)
 * @throws {Error} Si los porcentajes de distribución no suman 1.0
 */
function calculatePool(currentPlayers) {
  var cfg = POOL_CONFIG;

  // ── Validación: la distribución debe sumar exactamente 1.0 ──────────────
  var distSum = cfg.distribution.first
              + cfg.distribution.second
              + cfg.distribution.third
              + cfg.distribution.house;

  // Usamos tolerancia para evitar errores de punto flotante
  if (Math.abs(distSum - 1.0) > 0.0001) {
    throw new Error(
      'POOL_CONFIG.distribution no suma 1.0 (suma actual: ' + distSum.toFixed(4) + ')'
    );
  }

  var players = Math.max(0, Math.floor(currentPlayers));

  // ── Pozo total bruto ────────────────────────────────────────────────────
  var pool = players * cfg.subscriptionPrice;

  // ── Premios ─────────────────────────────────────────────────────────────
  var prizes = {
    first : pool * cfg.distribution.first,
    second: pool * cfg.distribution.second,
    third : pool * cfg.distribution.third,
    total : pool * (cfg.distribution.first + cfg.distribution.second + cfg.distribution.third)
  };

  // ── Costos de Stripe ────────────────────────────────────────────────────
  // Comisión por jugador = (precio × %) + fijo por transacción
  var stripePerPlayer = (cfg.subscriptionPrice * cfg.stripe.percentFee) + cfg.stripe.fixedFee;
  var stripeTotal     = stripePerPlayer * players;

  // ── Costos fijos totales ────────────────────────────────────────────────
  var fixedTotal = cfg.fixedCosts.software + cfg.fixedCosts.programming;

  // ── Costos totales ──────────────────────────────────────────────────────
  var costsTotal = stripeTotal + fixedTotal;

  // ── Casa: porción bruta del pozo ────────────────────────────────────────
  var houseGross = pool * cfg.distribution.house;

  // ── Casa: ganancia neta (después de todos los costos) ───────────────────
  var houseNet        = houseGross - costsTotal;
  var houseNetPercent = pool > 0 ? (houseNet / pool) * 100 : 0;

  // ── Punto de equilibrio ──────────────────────────────────────────────────
  // Ingreso neto por jugador para la casa = (precio × %casa) − stripe por jugador
  var houseRevenuePerPlayer = (cfg.subscriptionPrice * cfg.distribution.house) - stripePerPlayer;

  // Jugadores necesarios para cubrir costos fijos
  // Si houseRevenuePerPlayer <= 0 el modelo no es viable
  var playersNeeded;
  if (houseRevenuePerPlayer <= 0) {
    playersNeeded = Infinity;
  } else {
    playersNeeded = Math.ceil(fixedTotal / houseRevenuePerPlayer);
  }

  var isAboveBreakEven = players >= playersNeeded;

  // ── Resultado ────────────────────────────────────────────────────────────
  return {
    players: players,
    pool   : pool,

    prizes: {
      first : prizes.first,
      second: prizes.second,
      third : prizes.third,
      total : prizes.total
    },

    costs: {
      stripe   : stripeTotal,
      fixed    : fixedTotal,
      total    : costsTotal,
      // Desglose útil para UI
      stripePerPlayer: stripePerPlayer
    },

    house: {
      gross     : houseGross,
      net       : houseNet,
      netPercent: houseNetPercent
    },

    breakEven: {
      playersNeeded   : playersNeeded,
      isAboveBreakEven: isAboveBreakEven,
      // Ingreso neto por jugador adicional (margen incremental)
      marginPerPlayer : houseRevenuePerPlayer
    }
  };
}

// ─── Helpers de formato ──────────────────────────────────────────────────────
/**
 * fmtUSD(n) — Formatea un número como moneda USD
 * @param {number} n
 * @returns {string} ej. "$1,234.56"
 */
function fmtUSD(n) {
  if (!isFinite(n)) return '—';
  return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * fmtPct(n) — Formatea un número como porcentaje con 1 decimal
 * @param {number} n  (ej. 31.4)
 * @returns {string}  ej. "31.4%"
 */
function fmtPct(n) {
  if (!isFinite(n)) return '—';
  return n.toFixed(1) + '%';
}
