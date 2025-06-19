// Audio persistence utilities using IndexedDB
import { GeneratedAudio } from "@/components/audio-gallery"

const DB_NAME = 'AudioStorageDB'
const DB_VERSION = 1
const STORE_NAME = 'audios'
const MAX_STORAGE_BYTES = 50 * 1024 * 1024 // 50MB limit

interface AudioDB {
  db: IDBDatabase | null
  isInitialized: boolean
}

const audioDb: AudioDB = {
  db: null,
  isInitialized: false
}

// Initialize IndexedDB
async function initDB(): Promise<IDBDatabase> {
  if (audioDb.db && audioDb.isInitialized) {
    return audioDb.db
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      console.error('[AudioPersistence] Failed to open IndexedDB:', request.error)
      reject(request.error)
    }

    request.onsuccess = () => {
      audioDb.db = request.result
      audioDb.isInitialized = true
      console.log('[AudioPersistence] IndexedDB initialized successfully')
      resolve(request.result)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      
      // Create audio store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('timestamp', 'timestamp', { unique: false })
        store.createIndex('scriptHash', 'scriptHash', { unique: false })
        console.log('[AudioPersistence] Created audio object store')
      }
    }
  })
}

// Calculate size of audio data
function calculateAudioSize(audio: GeneratedAudio): number {
  // Rough estimate: base64 is ~1.33x the binary size
  const base64Size = audio.audioBase64.length
  const binarySize = Math.ceil(base64Size * 0.75)
  
  // Add metadata size (rough estimate)
  const metadataSize = JSON.stringify({
    ...audio,
    audioBase64: '' // Don't count the audio data twice
  }).length
  
  return binarySize + metadataSize
}

// Get total storage size
async function getTotalStorageSize(): Promise<number> {
  try {
    const db = await initDB()
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.getAll()

    return new Promise((resolve) => {
      request.onsuccess = () => {
        const audios = request.result as GeneratedAudio[]
        const totalSize = audios.reduce((sum, audio) => sum + calculateAudioSize(audio), 0)
        resolve(totalSize)
      }
      request.onerror = () => {
        console.error('[AudioPersistence] Failed to calculate storage size')
        resolve(0)
      }
    })
  } catch (error) {
    console.error('[AudioPersistence] Error getting storage size:', error)
    return 0
  }
}

// Clean up old audio files if storage limit exceeded
async function cleanupOldAudios(requiredSpace: number): Promise<void> {
  const db = await initDB()
  const transaction = db.transaction([STORE_NAME], 'readwrite')
  const store = transaction.objectStore(STORE_NAME)
  const index = store.index('timestamp')
  
  // Get all audios sorted by timestamp (oldest first)
  const request = index.openCursor()
  let deletedSize = 0

  request.onsuccess = (event) => {
    const cursor = (event.target as IDBRequest).result
    if (cursor && deletedSize < requiredSpace) {
      const audio = cursor.value as GeneratedAudio
      deletedSize += calculateAudioSize(audio)
      cursor.delete()
      console.log(`[AudioPersistence] Deleted old audio: ${audio.id}`)
      cursor.continue()
    }
  }
}

// Save audio to IndexedDB
export async function saveAudio(audio: GeneratedAudio & { scriptHash?: string }): Promise<boolean> {
  try {
    const db = await initDB()
    
    // Check storage limit
    const audioSize = calculateAudioSize(audio)
    const currentSize = await getTotalStorageSize()
    
    if (currentSize + audioSize > MAX_STORAGE_BYTES) {
      console.log('[AudioPersistence] Storage limit exceeded, cleaning up old audios')
      await cleanupOldAudios(audioSize)
    }
    
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.put(audio)

    return new Promise((resolve) => {
      request.onsuccess = () => {
        console.log(`[AudioPersistence] Saved audio: ${audio.id}`)
        resolve(true)
      }
      request.onerror = () => {
        console.error('[AudioPersistence] Failed to save audio:', request.error)
        resolve(false)
      }
    })
  } catch (error) {
    console.error('[AudioPersistence] Error saving audio:', error)
    return false
  }
}

// Load all audios from IndexedDB
export async function loadAudios(): Promise<GeneratedAudio[]> {
  try {
    const db = await initDB()
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.getAll()

    return new Promise((resolve) => {
      request.onsuccess = () => {
        const audios = request.result as GeneratedAudio[]
        console.log(`[AudioPersistence] Loaded ${audios.length} audios`)
        // Sort by timestamp, newest first
        audios.sort((a, b) => b.timestamp - a.timestamp)
        resolve(audios)
      }
      request.onerror = () => {
        console.error('[AudioPersistence] Failed to load audios:', request.error)
        resolve([])
      }
    })
  } catch (error) {
    console.error('[AudioPersistence] Error loading audios:', error)
    return []
  }
}

// Delete audio from IndexedDB
export async function deleteAudio(audioId: string): Promise<boolean> {
  try {
    const db = await initDB()
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.delete(audioId)

    return new Promise((resolve) => {
      request.onsuccess = () => {
        console.log(`[AudioPersistence] Deleted audio: ${audioId}`)
        resolve(true)
      }
      request.onerror = () => {
        console.error('[AudioPersistence] Failed to delete audio:', request.error)
        resolve(false)
      }
    })
  } catch (error) {
    console.error('[AudioPersistence] Error deleting audio:', error)
    return false
  }
}

// Get audios by script hash
export async function getAudiosByScriptHash(scriptHash: string): Promise<GeneratedAudio[]> {
  try {
    const db = await initDB()
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const index = store.index('scriptHash')
    const request = index.getAll(scriptHash)

    return new Promise((resolve) => {
      request.onsuccess = () => {
        const audios = request.result as GeneratedAudio[]
        resolve(audios)
      }
      request.onerror = () => {
        console.error('[AudioPersistence] Failed to get audios by script hash:', request.error)
        resolve([])
      }
    })
  } catch (error) {
    console.error('[AudioPersistence] Error getting audios by script hash:', error)
    return []
  }
}

// Clear all audios (for debugging/reset)
export async function clearAllAudios(): Promise<boolean> {
  try {
    const db = await initDB()
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.clear()

    return new Promise((resolve) => {
      request.onsuccess = () => {
        console.log('[AudioPersistence] Cleared all audios')
        resolve(true)
      }
      request.onerror = () => {
        console.error('[AudioPersistence] Failed to clear audios:', request.error)
        resolve(false)
      }
    })
  } catch (error) {
    console.error('[AudioPersistence] Error clearing audios:', error)
    return false
  }
}