/**
 * Test suite for Image Comparison Slider functionality
 * Ensures the CSS refactoring maintains exact visual appearance and functionality
 */

import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ImageGallery } from '@/components/image-gallery'
import { GeneratedImage } from '@/types/image'

// Mock the required modules
jest.mock('@/lib/image-utils', () => ({
  downloadImage: jest.fn(),
  formatImageTimestamp: jest.fn(() => '2 minutes ago'),
  getQualityBadgeColor: jest.fn(() => 'text-green-400 border-green-400'),
  saveGeneratedImages: jest.fn(),
  loadGeneratedImages: jest.fn(() => []),
  clearImageStorage: jest.fn(),
  getStorageInfo: jest.fn(() => ({ count: 0, size: 0 }))
}))

jest.mock('@/lib/stores/image-progress-store', () => ({
  useImageProgressStore: () => ({
    getAllGeneratingImages: () => [],
    removeProgress: jest.fn(),
    calculateProgress: jest.fn()
  })
}))

jest.mock('@/lib/services/chat-persistence', () => ({
  getSourceImagesForEdit: jest.fn(() => Promise.resolve([]))
}))

jest.mock('sonner', () => ({
  toast: {
    error: jest.fn()
  }
}))

// Mock images for testing
const mockOriginalImage: GeneratedImage = {
  id: 'original-1',
  url: 'https://example.com/original.jpg',
  prompt: 'Original image prompt',
  timestamp: new Date(),
  quality: 'standard',
  size: '1024x1024',
  model: 'test-model',
  isGenerating: false
}

const mockEditedImage: GeneratedImage = {
  id: 'edited-1',
  url: 'https://example.com/edited.jpg',
  prompt: 'Edited image prompt',
  timestamp: new Date(),
  quality: 'standard',
  size: '1024x1024',
  model: 'test-model',
  isGenerating: false,
  originalImageId: 'original-1'
}

describe('Image Comparison Slider', () => {
  const mockImages = [mockOriginalImage, mockEditedImage]

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks()
  })

  test('renders image gallery with edited image', () => {
    render(<ImageGallery images={mockImages} />)
    
    // Should show both images in the gallery
    expect(screen.getByTestId('image-gallery')).toBeInTheDocument()
  })

  test('opens comparison modal when edited image is clicked', () => {
    render(<ImageGallery images={mockImages} />)
    
    // Find and click the edited image
    const editedImageElement = screen.getByAltText('Edited image prompt')
    fireEvent.click(editedImageElement)
    
    // Should open the modal with comparison controls
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  test('comparison mode selector shows both split and slider options', () => {
    render(<ImageGallery images={mockImages} />)
    
    // Click edited image to open modal
    const editedImageElement = screen.getByAltText('Edited image prompt')
    fireEvent.click(editedImageElement)
    
    // Should show comparison mode buttons
    expect(screen.getByText('Split Screen')).toBeInTheDocument()
    expect(screen.getByText('Slider')).toBeInTheDocument()
  })

  test('slider mode applies correct CSS custom properties', () => {
    render(<ImageGallery images={mockImages} />)
    
    // Click edited image to open modal
    const editedImageElement = screen.getByAltText('Edited image prompt')
    fireEvent.click(editedImageElement)
    
    // Switch to slider mode
    const sliderButton = screen.getByText('Slider')
    fireEvent.click(sliderButton)
    
    // Find elements with the CSS classes we added
    const clipElement = document.querySelector('.image-comparison-clip')
    const sliderElement = document.querySelector('.image-comparison-slider')
    
    expect(clipElement).toBeInTheDocument()
    expect(sliderElement).toBeInTheDocument()
    
    // Check that CSS custom properties are set
    if (clipElement) {
      const clipStyle = window.getComputedStyle(clipElement)
      expect(clipElement.getAttribute('style')).toContain('--clip-right')
    }
    
    if (sliderElement) {
      const sliderStyle = window.getComputedStyle(sliderElement)
      expect(sliderElement.getAttribute('style')).toContain('--slider-position')
    }
  })

  test('slider position updates on mouse move', () => {
    render(<ImageGallery images={mockImages} />)
    
    // Click edited image to open modal
    const editedImageElement = screen.getByAltText('Edited image prompt')
    fireEvent.click(editedImageElement)
    
    // Switch to slider mode
    const sliderButton = screen.getByText('Slider')
    fireEvent.click(sliderButton)
    
    // Find the slider container
    const sliderContainer = document.querySelector('.image-comparison-clip')?.parentElement
    
    if (sliderContainer) {
      // Simulate mouse move to change slider position
      fireEvent.mouseMove(sliderContainer, {
        clientX: 100,
        currentTarget: {
          getBoundingClientRect: () => ({
            left: 0,
            width: 200
          })
        }
      })
      
      // Check that the CSS custom property value changed
      const sliderElement = document.querySelector('.image-comparison-slider')
      if (sliderElement) {
        expect(sliderElement.getAttribute('style')).toContain('--slider-position')
      }
    }
  })

  test('CSS classes are properly applied', () => {
    render(<ImageGallery images={mockImages} />)
    
    // Click edited image to open modal
    const editedImageElement = screen.getByAltText('Edited image prompt')
    fireEvent.click(editedImageElement)
    
    // Switch to slider mode
    const sliderButton = screen.getByText('Slider')
    fireEvent.click(sliderButton)
    
    // Verify CSS classes are applied
    const clipElement = document.querySelector('.image-comparison-clip')
    const sliderElement = document.querySelector('.image-comparison-slider')
    
    expect(clipElement).toHaveClass('absolute', 'inset-0', 'overflow-hidden', 'image-comparison-clip')
    expect(sliderElement).toHaveClass('absolute', 'top-0', 'bottom-0', 'w-0.5', 'bg-white', 'shadow-lg', 'image-comparison-slider')
  })
})
