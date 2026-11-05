import { mount } from 'svelte';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '@fontsource-variable/newsreader/opsz.css';
import '@fontsource-variable/newsreader/opsz-italic.css';
import './app.css';
import App from './App.svelte';
import { isMac } from './lib/keys';

// Styles that differ by system (room for the Mac's window buttons) key on this.
document.documentElement.dataset.os = isMac ? 'mac' : 'other';

export default mount(App, { target: document.getElementById('app')! });
