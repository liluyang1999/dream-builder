import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { M2EvidenceWorkbench } from '../playtest/M2EvidenceWorkbench';

describe('M2EvidenceWorkbench', () => {
  test('starts as a local-only five-player evidence draft without claiming completion', () => {
    render(<M2EvidenceWorkbench />);

    expect(screen.getByRole('heading', { name: 'M2 验收证据工作台' })).toBeTruthy();
    expect(screen.getByText('M2 仍在进行中')).toBeTruthy();
    expect(screen.getByText(/本页不联网/)).toBeTruthy();
    expect(screen.getAllByTestId('m2-observation')).toHaveLength(5);

    const gateTable = screen.getByRole('table', { name: 'M2 门槛判定' });
    expect(within(gateTable).getByText('原生十分钟报告')).toBeTruthy();
    expect(within(gateTable).getByText('M2 帧率预算')).toBeTruthy();
    expect((screen.getByLabelText('系统缩放（%）') as HTMLInputElement).value).toBe('250');
    expect((screen.getByLabelText('渲染设备像素比（DPR）') as HTMLInputElement).value).toBe(
      '2.625',
    );
    expect((screen.getByLabelText('渲染视口宽度（CSS px）') as HTMLInputElement).value).toBe(
      '1220',
    );
    expect((screen.getByLabelText('渲染视口高度（CSS px）') as HTMLInputElement).value).toBe('744');
    expect((screen.getByLabelText('应用版本') as HTMLInputElement).value).toBe('1.0');
  });

  test('keeps participant identity out of the form contract', () => {
    render(<M2EvidenceWorkbench />);

    expect(screen.getAllByLabelText(/匿名编号/)).toHaveLength(5);
    expect(screen.queryByLabelText(/姓名/)).toBeNull();
    expect(screen.getByText(/不要记录姓名、账号、联系方式或玩家路径/)).toBeTruthy();
  });

  test('keeps an expanded participant form mounted while its anonymous code is edited', () => {
    render(<M2EvidenceWorkbench />);
    const secondObservation = screen.getAllByTestId('m2-observation')[1] as
      | HTMLDetailsElement
      | undefined;
    const secondCode = screen.getAllByLabelText(/匿名编号/)[1];
    if (!secondObservation || !secondCode) throw new Error('Missing second observation');

    secondObservation.open = true;
    fireEvent(secondObservation, new Event('toggle'));
    fireEvent.change(secondCode, { target: { value: 'P22' } });

    expect(screen.getAllByTestId('m2-observation')[1]).toBe(secondObservation);
    expect(secondObservation.open).toBe(true);
  });
});
