import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { JobBoardFilterSheet } from './JobBoardFilterSheet';
import { EMPTY_JOB_BOARD_FILTER } from './job-board-filter-state';

const options = {
  now: '2026-11-01T08:00:00.000Z',
  projects: [{ id: 'p-1', name: 'PRA' }, { id: 'p-2', name: 'PRB' }],
  areas: [{ id: 'a-1', name: 'KQ01' }, { id: 'a-2', name: 'GAA03' }],
  workTypes: [{ id: 'w-1', name: 'BTCT' }, { id: 'w-2', name: 'Xây' }],
  trades: [{ id: 't-1', name: 'Thợ cát' }],
};

const baseProps = {
  visible: true,
  initial: { ...EMPTY_JOB_BOARD_FILTER, areaIds: [], workTypeIds: [] },
  options,
  optionsLoading: false,
  submitting: false,
  onClose: jest.fn(),
  onApply: jest.fn(),
};

describe('JobBoardFilterSheet (JOB-SRS-006, issue #46)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('multi-select: toggles two area chips and applies both', () => {
    render(<JobBoardFilterSheet {...baseProps} />);
    fireEvent.press(screen.getByLabelText('filter area KQ01'));
    fireEvent.press(screen.getByLabelText('filter area GAA03'));
    fireEvent.press(screen.getByLabelText('apply job board filter'));
    expect(baseProps.onApply).toHaveBeenCalledTimes(1);
    expect(baseProps.onApply.mock.calls[0][0]).toMatchObject({ areaIds: ['a-1', 'a-2'] });
  });

  it('project is single-select: picking a second project replaces the first', () => {
    render(<JobBoardFilterSheet {...baseProps} />);
    fireEvent.press(screen.getByLabelText('filter project PRA'));
    fireEvent.press(screen.getByLabelText('filter project PRB'));
    fireEvent.press(screen.getByLabelText('apply job board filter'));
    expect(baseProps.onApply.mock.calls[0][0]).toMatchObject({ projectId: 'p-2' });
  });

  it('skill=mine toggle is applied', () => {
    render(<JobBoardFilterSheet {...baseProps} />);
    fireEvent.press(screen.getByLabelText('filter skill mine toggle'));
    fireEvent.press(screen.getByLabelText('apply job board filter'));
    expect(baseProps.onApply.mock.calls[0][0]).toMatchObject({ skillMine: true });
  });

  it('client validation: from > to blocks submit and shows per-field errors', () => {
    render(<JobBoardFilterSheet {...baseProps} />);
    fireEvent.changeText(screen.getByLabelText('filter date from input'), '2026-02-20T00:00:00+07:00');
    fireEvent.changeText(screen.getByLabelText('filter date to input'), '2026-02-10T00:00:00+07:00');
    fireEvent.press(screen.getByLabelText('apply job board filter'));
    expect(baseProps.onApply).not.toHaveBeenCalled();
    expect(screen.getByLabelText('filter date from error')).toBeTruthy();
    expect(screen.getByLabelText('filter date to error')).toBeTruthy();
  });

  it('client validation: naive ISO blocks submit', () => {
    render(<JobBoardFilterSheet {...baseProps} />);
    fireEvent.changeText(screen.getByLabelText('filter date from input'), '2026-02-10T00:00:00');
    fireEvent.press(screen.getByLabelText('apply job board filter'));
    expect(baseProps.onApply).not.toHaveBeenCalled();
    expect(screen.getByLabelText('filter date from error')).toBeTruthy();
  });

  it('reset clears everything and applies the empty filter', () => {
    render(
      <JobBoardFilterSheet
        {...baseProps}
        initial={{ projectId: 'p-1', areaIds: ['a-1'], workTypeIds: ['w-1'], dateFrom: '2026-02-10T00:00:00+07:00', dateTo: undefined, skillMine: true }}
      />,
    );
    fireEvent.press(screen.getByLabelText('reset job board filter'));
    expect(baseProps.onApply).toHaveBeenCalledTimes(1);
    const applied = baseProps.onApply.mock.calls[0][0];
    expect(applied).toMatchObject({ areaIds: [], workTypeIds: [], skillMine: false });
    expect(applied.projectId).toBeUndefined();
  });

  it('submit is disabled while filter-loading (busy-guard)', () => {
    render(<JobBoardFilterSheet {...baseProps} submitting />);
    expect(screen.getByLabelText('apply job board filter').props.accessibilityState).toMatchObject({ disabled: true });
  });
});
