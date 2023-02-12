import { createSignal, JSX } from 'solid-js';
import 'components/Counter.css';

const Counter = (): JSX.Element => {
  const [count, setCount] = createSignal(0);
  return (
    <button class="button" onClick={() => setCount(count() + 1)}>
      {count} click count
    </button>
  );
};

export default Counter;
