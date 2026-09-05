import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { AudioDirector } from '../audio/AudioDirector';
import { forestAudio } from '../audio/forestAudio';

function audioNode() {
  return {
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    gain: { value: 0, setTargetAtTime: vi.fn() },
    frequency: { value: 0 },
    Q: { value: 0 },
  };
}

class TestAudioContext {
  static instances: TestAudioContext[] = [];
  static resumeAction: () => Promise<void> = async () => {};
  state = 'suspended';
  currentTime = 0;
  sampleRate = 8;
  destination = audioNode();
  close = vi.fn(async () => {
    this.state = 'closed';
  });
  constructor() {
    TestAudioContext.instances.push(this);
  }
  async resume(): Promise<void> {
    await TestAudioContext.resumeAction();
    this.state = 'running';
  }
  createGain = audioNode;
  createOscillator = audioNode;
  createBufferSource = audioNode;
  createBiquadFilter = audioNode;
  createBuffer(_channels: number, size: number) {
    return { getChannelData: () => new Float32Array(size) };
  }
}

describe('forest audio lifetime', () => {
  beforeEach(() => {
    TestAudioContext.instances = [];
    TestAudioContext.resumeAction = async () => {};
    vi.stubGlobal('AudioContext', TestAudioContext);
  });
  afterEach(() => {
    cleanup();
    forestAudio.dispose();
    vi.unstubAllGlobals();
  });

  test('keeps a rejected browser unlock recoverable for the next gesture', async () => {
    TestAudioContext.resumeAction = async () => {
      throw new Error('gesture required');
    };
    await expect(forestAudio.unlock()).resolves.toBe(false);
    TestAudioContext.resumeAction = async () => {};
    await expect(forestAudio.unlock()).resolves.toBe(true);
  });

  test('ignores a suspended unlock that resolves after disposal and a new context', async () => {
    let resume!: () => void;
    TestAudioContext.resumeAction = () =>
      new Promise<void>((resolve) => {
        resume = resolve;
      });
    const pending = forestAudio.unlock();
    forestAudio.dispose();
    TestAudioContext.resumeAction = async () => {};
    await expect(forestAudio.unlock()).resolves.toBe(true);
    resume();
    await expect(pending).resolves.toBe(false);
    expect(TestAudioContext.instances[1]?.state).toBe('running');
  });

  test('closes audio on unmount and unlocks a fresh graph after a StrictMode remount', async () => {
    const first = render(
      <StrictMode>
        <AudioDirector />
      </StrictMode>,
    );
    await act(async () => {
      fireEvent.pointerDown(window);
    });
    expect(TestAudioContext.instances).toHaveLength(1);
    first.unmount();
    expect(TestAudioContext.instances[0]?.close).toHaveBeenCalledTimes(1);
    render(
      <StrictMode>
        <AudioDirector />
      </StrictMode>,
    );
    await act(async () => {
      fireEvent.pointerDown(window);
    });
    expect(TestAudioContext.instances).toHaveLength(2);
    expect(TestAudioContext.instances[1]?.state).toBe('running');
  });
});
