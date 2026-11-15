export const m = (key, delta) => ({ type: 'meter', key, delta });
export const flag = (key, value = true) => ({ type: 'flag', key, value });
export const fact = (key) => ({ type: 'fact', key });
export const later = (delay, effects, text) => ({ type: 'later', delay, effects, text });
export const schedule = (eventId, delay) => ({ type: 'schedule', eventId, delay });
