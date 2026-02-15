'use client'

/**
 * FileUpload Component — Drag & Drop for PDF/DOCX/TXT
 * 
 * Features:
 * - Drag & drop zone
 * - Click to select file
 * - Upload to /api/upload → returns extracted text
 * - Shows file name, size, parsing progress
 * - Callback with extracted text
 */

import { useState, useCallback, useRef } from 'react'

interface FileUploadProps {
  onTextExtracted: (text: string, fileName: string) => void
  disabled?: boolean
  className?: string
}

const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.txt']
const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
]
const MAX_FILE_SIZE_MB = 10

export function FileUpload({ onTextExtracted, disabled = false, className = '' }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (file: File) => {
    setError(null)
    setUploadedFile(null)

    // Validate extension
    const ext = '.' + file.name.toLowerCase().split('.').pop()
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setError(`Непідтримуваний формат: ${ext}. Підтримуються: ${ACCEPTED_EXTENSIONS.join(', ')}`)
      return
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`Файл занадто великий (${(file.size / 1024 / 1024).toFixed(1)}MB). Максимум: ${MAX_FILE_SIZE_MB}MB.`)
      return
    }

    setIsUploading(true)

    try {
      // For TXT files, read directly
      if (ext === '.txt') {
        const text = await file.text()
        setUploadedFile({ name: file.name, size: file.size })
        onTextExtracted(text, file.name)
        setIsUploading(false)
        return
      }

      // For PDF/DOCX, upload to backend
      const formData = new FormData()
      formData.append('file', file)

      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
      const response = await fetch(`${backendUrl}/api/upload`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || `Помилка завантаження: ${response.status}`)
      }

      const result = await response.json()
      
      if (!result.text) {
        throw new Error('Не вдалося витягти текст з файлу')
      }

      setUploadedFile({ name: file.name, size: file.size })
      onTextExtracted(result.text, file.name)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка при обробці файлу')
    } finally {
      setIsUploading(false)
    }
  }, [onTextExtracted])

  // Drag & drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) setIsDragging(true)
  }, [disabled])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (disabled) return

    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [disabled, handleFile])

  // Click handler
  const handleClick = useCallback(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.click()
    }
  }, [disabled])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    // Reset input so the same file can be selected again
    if (inputRef.current) inputRef.current.value = ''
  }, [handleFile])

  return (
    <div className={className}>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`
          relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed
          px-6 py-8 text-center transition-all cursor-pointer
          ${disabled ? 'opacity-50 cursor-not-allowed border-gray-200 bg-gray-50' : ''}
          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'}
          ${isUploading ? 'pointer-events-none' : ''}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(',')}
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled}
        />

        {isUploading ? (
          <>
            <div className="animate-spin text-3xl">⏳</div>
            <p className="text-sm text-gray-600">Обробляю файл...</p>
          </>
        ) : uploadedFile ? (
          <>
            <div className="text-3xl">✅</div>
            <p className="text-sm font-medium text-green-700">{uploadedFile.name}</p>
            <p className="text-xs text-gray-500">
              {(uploadedFile.size / 1024).toFixed(0)}KB • Текст витягнуто
            </p>
            <p className="text-xs text-blue-600 mt-1">Натисніть щоб замінити файл</p>
          </>
        ) : (
          <>
            <div className="text-3xl">📄</div>
            <p className="text-sm font-medium text-gray-700">
              Перетягніть файл сюди або натисніть
            </p>
            <p className="text-xs text-gray-500">
              PDF, DOCX, TXT • Максимум {MAX_FILE_SIZE_MB}MB
            </p>
          </>
        )}
      </div>

      {error && (
        <div className="mt-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  )
}
