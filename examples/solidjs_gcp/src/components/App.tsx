import { Component, createSignal, onCleanup } from 'solid-js';
import logo from 'assets/logo.svg';
import wordmark from 'assets/wordmark.svg';
import 'components/App.css';
import Counter from 'components/Counter';

const App: Component = () => {
  const [time, setTime] = createSignal(0),
    timer = setInterval(() => setTime(time() + 1), 1000);
  onCleanup(() => clearInterval(timer));
  return (
    <div class="App font-sans">
      <header class="App-header">
        <img src={logo} class="App-logo" alt="logo" />
        <a class="App-link" href="https://solidjs.com" target="_blank" rel="noopener noreferrer">
          <img src={wordmark} class="App-wordmark" alt="wordmark" />
        </a>
        <p>
          Edit <code>src/App.tsx</code> and save to reload.
        </p>
        <p>
          Page has been open for <code>{time}</code> seconds.
        </p>
        <Counter />
      </header>
    </div>
  );
};

export default App;
