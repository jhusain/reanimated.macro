<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [reanimated.macro](#reanimatedmacro)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

# reanimated.macro

React-native-reanimated achieves excellent performance by allowing developers to describe operations on animated value as a data structure. Unfortunately expressing your code as a data structure structure can be awkward. This approach requires you to use special functions for control flow, assignment, and mathematical operations rather than using idiomatic JavaScript syntax. As an example, consider the code below:

```js
const getAnimation = (min, max) => {
  const clock = new Clock()
  const state = {
    finished: new Value(1),
    position: new Value(min),
    time: new Value(0),
    frameTime: new Value(0),
  }

  const config = {
    duration: 500,
    toValue: new Value(0),
    easing: Easing.inOut(Easing.ease),
  }

  const reset = [
    set(state.finished, 0),
    set(state.time, 0),
    set(state.frameTime, 0),
  ]

  return block([
    cond(and(state.finished, eq(state.position, min)), [
      ...reset,
      set(config.toValue, max),
    ]),
    cond(and(state.finished, eq(state.position, max)), [
      ...reset,
      set(config.toValue, min),
    ]),
    cond(clockRunning(clock), 0, startClock(clock)),
    timing(clock, state, config),
    state.position,
  ])
}
```

Using the reanimated macro, the code above can be rewritten this way:

```js
import {exec, animate} from 'reanimated.macro';

const getAnimation = (min, max) => {
  const clock = new Clock();
  const state = {
    finished: new Value(1),
    position: new Value(min),
    time: new Value(0),
    frameTime: new Value(0),
  };

  const config = {
    duration: 500,
    toValue: new Value(0),
    easing: Easing.inOut(Easing.ease),
  };

  const reset = define() => {
    state.finished = 0;
    state.time = 0;
    state.frameTime = 0;
  });

  return define(() => {
    if(state.finished && state.position === min) {
      exec(reset);
      config.toValue = max;
    }
    else if(state.finished && state.position === max) {
      exec(reset);
      config.toValue = min;
    }
    if(!clockRunning(clock)) {
      startClock(clock);
    }
    timing(clock, state, config);
    return state.position,
  });
};
```
