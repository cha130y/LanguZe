/**
 * Days and daily limits run on Bangkok time, whoever is reading and wherever they
 * are (V1, FR-080). The API says when the count starts again; this only writes that
 * instant in the time zone the rule is stated in, so "เที่ยงคืน" is not a promise
 * the page makes on its own.
 */
const BANGKOK = 'Asia/Bangkok';

/** The reset time as a Thai reader would write it, such as `26 ก.ย. 00:00`. */
export function resetsAtText(resetsAt: string): string {
  const at = new Date(resetsAt);
  if (Number.isNaN(at.getTime())) return '';
  return new Intl.DateTimeFormat('th-TH', {
    timeZone: BANGKOK,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(at);
}
