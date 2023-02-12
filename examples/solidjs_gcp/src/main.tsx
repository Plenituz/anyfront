import { render } from 'solid-js/web';
import App from 'components/App';
import 'main.css';

const root = document.querySelector('#app');
if (root) render(() => <App />, root);

// export const moduleHotAccept = (module_: NodeModule): void => {
// eslint-disable-next-line @typescript-eslint/no-unsafe-call
// };

// eslint-disable-next-line unicorn/prefer-module
// moduleHotAccept(module);
