const apiBase = import.meta.env.VITE_API_BASE || '/api'

export async function apiRequest(path, { method = 'GET', body, csrfToken } = {}) {
  let response
  try {
    response = await fetch(`${apiBase}${path}`, {
      method,
      credentials: 'include',
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
  } catch {
    throw new Error('The hotel service could not be reached. Please try again in a moment.')
  }

  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(result.error || `The request failed (${response.status}).`)
  }
  return result
}

export async function downloadFile(path) {
  let response
  try {
    response = await fetch(`${apiBase}${path}`, { credentials: 'include' })
  } catch {
    throw new Error('The hotel service could not be reached. Please try again in a moment.')
  }
  if (!response.ok) {
    const result = await response.json().catch(() => ({}))
    throw new Error(result.error || `The report could not be downloaded (${response.status}).`)
  }
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = path.split('/').pop().split('?')[0] || 'report.csv'
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
