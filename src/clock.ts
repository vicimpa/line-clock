import { vec2 } from "gl-matrix";
import data from "./data.txt?raw";

const { create, sub, scale, add } = vec2;

const PI1_2 = Math.PI / 2;

const width = 4;
const height = 6;

const variants = parse(data, width, height);
const store = new WeakMap<Node, clock>();

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      store.get(node)?.start();
    }

    for (const node of mutation.removedNodes) {
      store.get(node)?.stop();
    }
  }
});

observer.observe(document.body, { childList: true, subtree: true });

type segment = ReturnType<typeof segment>;

function segment(char = '', size = 32, duration = 300, delay = 0) {
  const node = document.createElement('canvas');
  const ctx = node.getContext('2d')!;
  var from = rotate(char), to = from, last = now();

  node.className = 'segment';
  node.width = size;
  node.height = size;

  function current() {
    const dt = clamp(now() - last, 0, duration);

    if (dt === duration)
      return to;

    const current = create();
    const t = dt / duration;
    return add(current, from, scale(current, sub(current, to, from), t));
  }

  function update() {
    if (from === to)
      return;

    const value = current();

    if (value === to)
      return render(from = value);

    render(value);
  }

  function render(value: vec2) {
    ctx.resetTransform();
    ctx.clearRect(0, 0, size, size);
    ctx.setTransform(1, 0, 0, -1, size / 2, size / 2);
    line(value[0] * PI1_2);
    line(value[1] * PI1_2);
  }

  function line(r = 0) {
    const width = 4;
    ctx.beginPath();
    ctx.lineWidth = width;
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.sin(r) * size, Math.cos(r) * size);
    ctx.moveTo(0, 0);
    ctx.stroke();
    ctx.arc(0, 0, width / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.closePath();
  }

  render(to);


  return {
    get char() {
      return char;
    },
    set char(v) {
      if (v === char)
        return;

      last = now() + delay;
      from = current();
      to = rotate(char = v);

      if (from[0] > Math.min(...to)) from[0] -= 4;
      if (from[1] > Math.min(...to)) from[1] -= 4;

      [from, to] = sort(from, to);

    },
    node,
    update,
  };
}

type digit = ReturnType<typeof digit>;

function digit(value = 0, size = 32, duration = 300) {
  var data = variant(value);
  const node = document.createElement('div');
  const segments = array(width * height, i => (
    segment(data[i], size, duration)
  ));

  function variant(n: number) {
    return variants[n | 0].map(e => [...e]).flat();
  }

  function set(value: number) {
    data = variant(value);
    segments.forEach((seg, i) => seg.char = data[i]);
    return segments;
  }

  node.className = 'digit';

  segments.forEach((e) => {
    node.appendChild(e.node);
  });

  return {
    node,
    get value() {
      return value;
    },
    set value(v) {
      if (v === value)
        return;

      set(value = v);
    },
    update() {
      segments.forEach(segment => segment.update());
    }
  };
}

type numeric = ReturnType<typeof numeric>;

function numeric(value = 0, count = 2, size = 32, duration = 300) {
  const node = document.createElement('div');
  const get = (i: number) => ((value / (10 ** (count - i - 1))) | 0) % 10;
  const digits = array(2, i => digit(get(i), size, duration));

  node.className = 'numeric';

  digits.forEach((e) => {
    node.appendChild(e.node);
  });

  return {
    node,
    get value() {
      return value;
    },
    set value(v) {
      if (v === value)
        return;

      value = v;
      digits.forEach((digit, i) => digit.value = get(i));
    },
    update() {
      digits.forEach(digit => digit.update());
    }
  };
}

type clock = {
  start(): void;
  stop(): void;
};

export function clock(size = 32, duration = 300) {
  var date = new Date(), run = false;
  const node = document.createElement('div');
  const numerics = array(3, i => numeric(get(i), 2, size, duration));

  node.className = 'clock';

  numerics.forEach((e) => {
    node.appendChild(e.node);
  });

  function get(i: number) {
    switch (i) {
      case 0: return date.getHours();
      case 1: return date.getMinutes();
      case 2: return date.getSeconds();
    }
    return 0;
  }


  function update() {
    if (!run) return;
    date = new Date();
    requestAnimationFrame(update);
    numerics.forEach((numeric, i) => numeric.value = get(i));
    numerics.forEach(numeric => numeric.update());
  }

  store.set(node, {
    start() {
      if (run) return;
      run = true;
      update();
    },
    stop() {
      run = false;
    }
  });

  return node;
}

function parse(data: string, width: number, height: number) {
  return data
    .split(/\n+/)
    .map(row => row.padEnd(width, ' ').slice(0, width))
    .reduce((acc, row) => {
      var current = acc.at(-1);

      if (!current || current.length >= height) {
        acc.push(current = []);
      }

      return (current.push(row), acc);
    }, [] as string[][]);
}

function rotate(char: string): vec2 {
  switch (char) {
    case '└': return [0, 1];
    case '│': return [0, 2];
    case '┘': return [0, 3];
    case '┌': return [1, 2];
    case '─': return [1, 3];
    case '┐': return [2, 3];
    default: return [2.5, 2.5];
  }
}

function now() {
  return performance.now();
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function array<T>(length: number, fn: (i: number) => T) {
  return Array.from({ length }, (_, i) => fn(i));
}


function fwd(a: number, b: number, max = 4): number {
  let d = (b - a) % max;
  return d < 0 ? d + max : d;
}

function sort(from: vec2, to: vec2, max = 4): [vec2, vec2] {
  const [a1, a2] = from;
  const [b1, b2] = to;

  // только вперёд
  const d11 = fwd(a1, b1, max), d12 = fwd(a2, b2, max);
  const d21 = fwd(a1, b2, max), d22 = fwd(a2, b1, max);

  // выбираем перестановку с меньшей суммой вращений
  if (d11 + d12 <= d21 + d22) {
    return [
      vec2.fromValues(a1, a2),
      vec2.fromValues((a1 + d11) % max, (a2 + d12) % max)
    ];
  } else {
    return [
      vec2.fromValues(a1, a2),
      vec2.fromValues((a1 + d21) % max, (a2 + d22) % max)
    ];
  }
}