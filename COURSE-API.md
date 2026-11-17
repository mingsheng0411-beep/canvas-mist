# Course reader v1

Call from an extension page or service worker belonging to Canvas Mist. Use the tab ID of an open UMD dashboard after the course cards appear.

```js
const response = await chrome.tabs.sendMessage(dashboardTabId, {
  type: 'mist.course.read.v1',
  courseId,
  resource: 'pages'
})
```

| Resource | Extra input | Data on success |
|---|---|---|
| pages | — | Array of page slugs in `url` and page titles in `title` |
| page | `slug` from the pages result | Object with `title` and `html` |
| assignments | — | Array of objects with `id`, `name`, `due_at`, and description in `html` |

A handled request resolves to `{ok:true,data}` or `{ok:false,error}`. A disconnected tab or absent listener can cause sendMessage to reject. Material is fetched on demand using the student's existing Canvas access. HTML fields contain course-authored content and may be null. Treat them as untrusted input.
