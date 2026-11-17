(async () => {
  if (!/^\/calendar\/?$/.test(location.pathname)) return
  const content = document.querySelector('#content')
  if (!content || document.querySelector('#mist-calendar')) return
  const {element, pages} = mistCanvas
  const {language} = await chrome.storage.local.get('language')
  const lang = language === 'zh' ? 'zh-CN' : 'en'
  const t = (en, zh) => language === 'zh' ? zh : en
  const labels = {
    exam:t('Exam','考试'), quiz:t('Quiz','小测'), assignment:t('Assignment','作业'), event:t('Event','其他事项')
  }
  function category(item) {
    if (item.plannable_type === 'announcement') return 'event'
    const title = item.plannable?.title || ''
    if (/\b(exams?|examinations?|midterms?|finals?)\b|考试|期中考|期末考/i.test(title)
        && !/\bfinal\s+(paper|draft|project|essay|report|presentation)\b/i.test(title)) return 'exam'
    if (item.plannable_type === 'quiz' || /\bquiz(?:zes)?\b|小测|测验/i.test(title)) return 'quiz'
    if (['assignment','discussion_topic','sub_assignment','assessment_request'].includes(item.plannable_type)) return 'assignment'
    return 'event'
  }
  function itemLink(item) {
    const path = item.html_url || item.plannable?.html_url
    const url = path && URL.parse(path,location.origin)
    if (url?.origin === location.origin && !/^\/(?:api\/|calendar\/?$)/.test(url.pathname)) return url.href
    const id = item.plannable_id || item.plannable?.id
    const routes = {assignment:'assignments', quiz:'quizzes', discussion_topic:'discussion_topics'}
    const route = routes[item.plannable_type]
    if (route && /^\d+$/.test(item.course_id) && /^\d+$/.test(id)) return '/courses/'+item.course_id+'/'+route+'/'+id
    return url?.origin === location.origin && !url.pathname.startsWith('/api/') ? url.href : null
  }
  function midnight(offset=0) {
    const date = new Date()
    date.setHours(0,0,0,0)
    date.setDate(date.getDate()+offset)
    return date
  }
  const section = element('section',null,'mist-calendar')
  section.id = 'mist-calendar'
  section.lang = lang
  const bar = element('div',null,'mist-bar')
  const heading = element('h2',t('Course calendar','课程日历'))
  const panel = element('div')
  panel.id = 'mist-week'
  const views = element('div',null,'mist-range')
  views.setAttribute('role','group')
  views.setAttribute('aria-label',t('Calendar view','日历视图'))
  const threeWeeks = element('button',t('3 weeks','3 周'))
  const native = element('button',t('Canvas calendar','原版 Canvas 日历'))
  for (const button of [threeWeeks,native]) {
    button.type = 'button'
    views.append(button)
  }
  function showWeek(show) {
    content.classList.toggle('mist-week-open',show)
    panel.hidden = !show
    threeWeeks.setAttribute('aria-pressed',String(show))
    native.setAttribute('aria-pressed',String(!show))
    if (!show) window.dispatchEvent(new Event('resize'))
  }
  threeWeeks.onclick = () => showWeek(true)
  native.onclick = () => showWeek(false)
  bar.append(heading,views)
  section.append(bar,panel)
  content.prepend(section)
  // Preserve links that open a specific event or a different calendar date.
  const hash = new URLSearchParams(location.hash.slice(1))
  const today = midnight()
  const localDate = new Date(today.getTime()-today.getTimezoneOffset()*60000).toISOString().slice(0,10)
  showWeek(!location.search && [...hash.keys()].every(k=>['view_name','view_start'].includes(k)) &&
    (!hash.get('view_start') || hash.get('view_start') === localDate))
  const grid = element('div',null,'mist-week-grid')
  const lists = new Map()
  for (let offset=-2; offset<=18; offset++) {
    const day = midnight(offset)
    const column = element('section',null,'mist-day')
    const title = element('h3',day.toLocaleDateString(lang,{weekday:'short',month:'short',day:'numeric'}))
    if (offset===0) {
      column.setAttribute('aria-current','date')
      title.prepend(element('b',t('Today','今天')))
    }
    const list = element('ul')
    lists.set(day.toDateString(),list)
    column.append(title,list)
    grid.append(column)
  }
  const status = element('p',t('Loading events…','正在读取日程…'))
  status.setAttribute('role','status')
  panel.append(status,grid)
  try {
    const params = new URLSearchParams({start_date:midnight(-2).toISOString(),end_date:midnight(19).toISOString(),per_page:'100'})
    const [items,courses] = await Promise.all([
      pages('/api/v1/planner/items?'+params),
      pages('/api/v1/courses?enrollment_state=active&per_page=100').catch(()=>[])
    ])
    const byId = new Map(courses.map(course=>[String(course.id),course]))
    const dated = items.map(item=>({item,date:new Date(item.plannable?.due_at || item.plannable_date)})).sort((a,b)=>a.date-b.date)
    for (const {item,date} of dated) {
      const list = lists.get(date.toDateString())
      if (!list) continue
      const kind = category(item)
      const row = element('li',null,'mist-item-'+kind)
      const course = byId.get(String(item.course_id))
      const fullName = course?.name || item.context_name || ''
      const codePattern = /\b[A-Z]{2,6}[ -]?\d{3,4}[A-Z]?\b/i
      const code = course?.course_code?.match(codePattern)?.[0] || fullName.match(codePattern)?.[0]
      const courseLabel = code || fullName || (item.course_id ? t('Course ','课程 ')+item.course_id : '')
      const url = itemLink(item)
      const entry = element(url ? 'a' : 'div',null,'mist-entry')
      if (url) entry.href = url
      const meta = element('small',[courseLabel,labels[kind]].filter(Boolean).join(' · '))
      meta.title = fullName
      const title = element('span',item.plannable?.title || labels[kind])
      title.title = title.textContent
      const time = element('time',item.plannable?.all_day ? t('All day','全天') : date.toLocaleTimeString(lang,{hour:'2-digit',minute:'2-digit',hourCycle:'h23'}))
      time.dateTime = date.toISOString()
      entry.append(meta,time,title)
      row.append(entry)
      list.append(row)
    }
    const detail = element('dialog',null,'mist-day-detail')
    const detailTitle = element('h3')
    detailTitle.id = 'mist-detail-title'
    detail.setAttribute('aria-labelledby',detailTitle.id)
    const close = element('button',t('Close','关闭'))
    close.type = 'button'
    close.onclick = () => detail.close()
    const detailBar = element('div',null,'mist-bar')
    detailBar.append(detailTitle,close)
    const allItems = element('ul')
    detail.append(detailBar,allItems)
    section.append(detail)
    for (const list of lists.values()) {
      const rows = Array.from(list.children)
      if (!rows.length) continue
      const day = list.parentElement
      const header = day.querySelector('h3')
      const dateButton = element('button',null,'mist-date-button')
      dateButton.type = 'button'
      dateButton.setAttribute('aria-haspopup','dialog')
      dateButton.append(...Array.from(header.childNodes))
      header.append(dateButton)
      const openDay = () => {
        detailTitle.textContent = dateButton.textContent
        allItems.replaceChildren(...rows.map(row=>row.cloneNode(true)))
        detail.showModal()
      }
      dateButton.onclick = openDay
      if (rows.length > 2) {
        list.replaceChildren(...rows.slice(0,2))
        const more = element('button',t('+'+(rows.length-2)+' more','另有 '+(rows.length-2)+' 项'),'mist-more')
        more.type = 'button'
        more.setAttribute('aria-haspopup','dialog')
        more.onclick = openDay
        day.append(more)
      }
    }
    status.remove()
  } catch {
    status.textContent = t('Events could not be loaded. Open the full Canvas calendar to view your schedule.','日程读取失败，可打开完整 Canvas 日历查看。')
  }
})()
