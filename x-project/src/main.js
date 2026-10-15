import { boot } from './ui/ui.js';

const go = (data) => boot(document.body, data || {});
window.claude?.hot?.ready ? window.claude.hot.ready(go) : go(window.claude?.hot?.data ?? {});
