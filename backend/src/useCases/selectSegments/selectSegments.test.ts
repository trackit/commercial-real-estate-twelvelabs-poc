import { describe, it, expect, vi } from 'vitest'
import { SelectSegmentsUseCase } from './selectSegments'
import { SegmentSelector } from '../../ports/segmentSelector'

describe('SelectSegmentsUseCase', () => {
  it('should select segments and calculate total duration', async () => {
    const mockSelector: SegmentSelector = {
      selectSegments: vi.fn().mockResolvedValue([
        { id: 0, title: 'Exterior', startTime: 0, endTime: 10 },
        { id: 2, title: 'Living Room', startTime: 20, endTime: 35 },
      ]),
    }

    const useCase = new SelectSegmentsUseCase(mockSelector)
    const result = await useCase.execute({
      analyses: [
        {
          id: 0,
          startTime: 0,
          endTime: 10,
          duration: 10,
          roomType: 'Exterior',
          title: 'Exterior',
          appealScore: 8,
          isHeroCandidate: true,
          isTransitionOnly: false,
        },
        {
          id: 1,
          startTime: 10,
          endTime: 20,
          duration: 10,
          roomType: 'Hallway',
          title: 'Hallway',
          appealScore: 3,
          isHeroCandidate: false,
          isTransitionOnly: true,
        },
        {
          id: 2,
          startTime: 20,
          endTime: 35,
          duration: 15,
          roomType: 'Living',
          title: 'Living Room',
          appealScore: 9,
          isHeroCandidate: true,
          isTransitionOnly: false,
        },
      ],
    })

    expect(result.selectedSegments).toHaveLength(2)
    expect(result.totalDuration).toBe(25)
  })

  it('should filter out transition-only segments', async () => {
    const mockSelector: SegmentSelector = {
      selectSegments: vi.fn().mockResolvedValue([]),
    }

    const useCase = new SelectSegmentsUseCase(mockSelector)
    await useCase.execute({
      analyses: [
        {
          id: 0,
          startTime: 0,
          endTime: 10,
          duration: 10,
          roomType: 'Living',
          title: 'Living',
          appealScore: 8,
          isHeroCandidate: false,
          isTransitionOnly: false,
        },
        {
          id: 1,
          startTime: 10,
          endTime: 20,
          duration: 10,
          roomType: 'Hallway',
          title: 'Hallway',
          appealScore: 2,
          isHeroCandidate: false,
          isTransitionOnly: true,
        },
      ],
    })

    expect(mockSelector.selectSegments).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 0, isTransitionOnly: false })]),
      undefined
    )
    expect(mockSelector.selectSegments).toHaveBeenCalledWith(
      expect.not.arrayContaining([expect.objectContaining({ id: 1, isTransitionOnly: true })]),
      undefined
    )
  })

  it('should return empty array when no valid candidates', async () => {
    const mockSelector: SegmentSelector = {
      selectSegments: vi.fn(),
    }

    const useCase = new SelectSegmentsUseCase(mockSelector)
    const result = await useCase.execute({
      analyses: [
        {
          id: 0,
          startTime: 0,
          endTime: 10,
          duration: 10,
          roomType: 'Hallway',
          title: 'Hallway',
          appealScore: 0,
          isHeroCandidate: false,
          isTransitionOnly: true,
        },
      ],
    })

    expect(result.selectedSegments).toHaveLength(0)
    expect(result.totalDuration).toBe(0)
    expect(mockSelector.selectSegments).not.toHaveBeenCalled()
  })
})
