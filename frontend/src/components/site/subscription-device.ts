/** The private key of a subscription (the token of the e-mail links) is remembered in this browser, so /subscribe can show the subscriber's own choices. */
const KEY = 'news.subscription';
const OK = /^[a-f0-9]{48}$/;

export const savedSubscription = (): string => { try { const v = localStorage.getItem(KEY) ?? ''; return OK.test(v) ? v : ''; } catch { return ''; } };
export const saveSubscription = (token: string) => { try { if (OK.test(token)) localStorage.setItem(KEY, token); } catch { /* private window: the page still works through the e-mail link */ } };
export const forgetSubscription = () => { try { localStorage.removeItem(KEY); } catch { /* nothing to forget */ } };
