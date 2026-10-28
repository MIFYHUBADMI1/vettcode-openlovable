type CreditRequestBody = {
  id: string
  body: Blob
  expiresAt: number
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("atai-credit-requests", 1)
    let database: IDBDatabase | undefined
    let failed = false

    request.onupgradeneeded = () => {
      database = request.result
      try {
        database.createObjectStore("bodies", { keyPath: "id" })
      } catch (error) {
        failed = true
        database.close()
        request.transaction?.abort()
        reject(error)
      }
    }
    request.onerror = () => {
      failed = true
      database?.close()
      reject(request.error ?? new Error("Could not open credit request storage"))
    }
    request.onblocked = () => {
      failed = true
      reject(new Error("Credit request storage is blocked"))
    }
    request.onsuccess = () => {
      // A blocked open can still succeed after the caller has fallen back.
      if (failed) request.result.close()
      else resolve(request.result)
    }
  })
}

export async function saveCreditRequestBody(body: Blob, expiresAt: number): Promise<string> {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is unavailable")
  }

  const id = crypto.randomUUID()
  const database = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("bodies", "readwrite")
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error("Credit request write failed"))
      transaction.onabort = () => reject(transaction.error ?? new Error("Credit request write aborted"))

      const store = transaction.objectStore("bodies")
      const now = Date.now()
      const request = store.openCursor()
      request.onsuccess = () => {
        const cursor = request.result
        if (!cursor) return
        const entry = cursor.value as CreditRequestBody
        if (entry.expiresAt <= now) cursor.delete()
        cursor.continue()
      }
      store.put({ id, body, expiresAt } satisfies CreditRequestBody)
    })
    return id
  } finally {
    database.close()
  }
}

export async function readCreditRequestBody(id: string): Promise<Blob | null> {
  if (typeof indexedDB === "undefined") return null

  const database = await openDatabase()
  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const transaction = database.transaction("bodies", "readwrite")
      let body: Blob | null = null
      transaction.oncomplete = () => resolve(body)
      transaction.onerror = () => reject(transaction.error ?? new Error("Credit request read failed"))
      transaction.onabort = () => reject(transaction.error ?? new Error("Credit request read aborted"))

      const store = transaction.objectStore("bodies")
      const request = store.get(id)
      request.onsuccess = () => {
        const entry = request.result as CreditRequestBody | undefined
        if (!entry) return
        if (entry.expiresAt <= Date.now()) store.delete(id)
        else body = entry.body
      }
    })
  } finally {
    database.close()
  }
}

export async function deleteCreditRequestBody(id: string): Promise<void> {
  if (typeof indexedDB === "undefined") return

  const database = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("bodies", "readwrite")
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error("Credit request deletion failed"))
      transaction.onabort = () => reject(transaction.error ?? new Error("Credit request deletion aborted"))
      transaction.objectStore("bodies").delete(id)
    })
  } finally {
    database.close()
  }
}
