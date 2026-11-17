const mistCanvas = (() => {
  function element(tag, text, className) {
    const node = document.createElement(tag)
    if (text != null) node.textContent = text
    if (className) node.className = className
    return node
  }

  async function pages(path) {
    const records = []
    let url = new URL(path, location.origin)
    while (url) {
      if (url.origin !== location.origin) throw Error('Invalid API origin')
      const response = await fetch(url, {headers: {Accept: 'application/json'}})
      if (!response.ok) throw Error('Canvas API unavailable')
      const batch = await response.json()
      if (!Array.isArray(batch)) throw Error('Invalid Canvas response')
      records.push(...batch)
      const next = response.headers.get('Link')?.match(/<([^>]+)>;\s*rel="next"/)
      url = next ? new URL(next[1], url) : null
    }
    return records
  }

  return {element, pages}
})()
