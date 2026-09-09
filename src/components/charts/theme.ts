/**
 * Chart colours. These are the brand's, re-stepped where a mark had to survive
 * the six checks in `validate_palette.js` against a white card:
 *   series pair  #0092AD / #5B3FE0  — all checks pass
 *   status trio  #1E7A52 / #C07E08 / #A32020 — passes contrast and the
 *   normal-vision floor; the red-to-green CVD pair sits in the 6-8 band, which
 *   is why every status mark here also carries a direct label.
 * The bright brand cyan (#00D2F5) stays on the UI surfaces, where it is not a
 * data mark.
 */
export const CHART = {
  cyan: '#0092AD',
  violet: '#5B3FE0',
  success: '#1E7A52',
  warning: '#C07E08',
  danger: '#A32020',
  neutral: '#94A3B8',
  track: '#E8EDF2',
  grid: '#EEF2F6',
  axis: '#97A1AC',
  label: '#5C6672',
  surface: '#FFFFFF',
} as const;

export const AXIS_TICK = { fill: CHART.label, fontSize: 11, fontWeight: 500 };

export const TOOLTIP_STYLE = {
  contentStyle: {
    borderRadius: 12,
    border: '1px solid #E3E8ED',
    boxShadow: '0 12px 32px rgba(27,36,48,0.16)',
    padding: '10px 12px',
    fontSize: 12,
  },
  labelStyle: { color: '#33307C', fontWeight: 700, marginBottom: 6, fontSize: 12 },
  itemStyle: { padding: 0, fontSize: 12 },
  cursor: { fill: 'rgba(0,146,173,0.06)' },
} as const;
