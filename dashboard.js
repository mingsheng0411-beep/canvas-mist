(async () => {
  if (!['/', '/dashboard', '/dashboard/'].includes(location.pathname)) return
  const dashboard = document.querySelector('#dashboard.ic-dashboard-app')
  if (!dashboard || document.querySelector('#mist-overview')) return

  const {element, pages} = mistCanvas

  function link(label, path) {
    const node = element('a', label)
    if (path) {
      const url = new URL(path, location.origin)
      if (url.origin === location.origin && url.protocol === 'https:') node.href = url.href
    }
    return node
  }

  let courses
  try {
    courses = await pages('/api/v1/courses?enrollment_state=active&include[]=total_scores&include[]=course_image&per_page=100')
  } catch { return } // Keep the native dashboard available when the course list is inaccessible.
  courses = courses.filter(course => course.name && course.id)
  if (!courses.length) return

  const prefs = await chrome.storage.local.get(['language', 'focusCourses'])
  let language = prefs.language === 'zh' ? 'zh' : 'en'
  const focused = new Set(prefs.focusCourses || [])
  function translate(node, en, zh) {
    node.dataset.en = en
    node.dataset.zh = zh
    node.textContent = node.dataset[language]
    return node
  }
  function labelNode(tag, en, zh) { return translate(element(tag), en, zh) }

  const overview = element('section')
  overview.id = 'mist-overview'
  const bar = element('div', null, 'mist-bar')
  const heading = labelNode('h1','My courses','我的课程')
  const toggle = labelNode('button','Canvas dashboard','查看原控制面板')
  toggle.type = 'button'
  const controls = element('div', null, 'mist-controls')
  const slider = element('button', null, 'mist-language')
  slider.type = 'button'
  slider.setAttribute('role','switch')
  slider.setAttribute('aria-label','Use Chinese / 使用中文')
  slider.append(element('span','EN'),element('span','中文'))
  function applyLanguage() {
    overview.lang = language === 'zh' ? 'zh-CN' : 'en'
    slider.setAttribute('aria-checked', String(language === 'zh'))
    for (const node of overview.querySelectorAll('[data-en]')) node.textContent = node.dataset[language]
    for (const time of overview.querySelectorAll('time[datetime]')) formatTime(time)
  }
  function formatTime(time) {
    time.textContent = new Date(time.dateTime).toLocaleString(overview.lang,{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})
  }
  slider.onclick = () => {
    language = language === 'en' ? 'zh' : 'en'
    applyLanguage()
    chrome.storage.local.set({language})
  }
  controls.append(slider,toggle)
  bar.append(heading,controls)
  const grid = element('div', null, 'mist-grid')
  overview.append(bar, grid)
  const nativeHeader = dashboard.querySelector(':scope > #dashboard_header_container, :scope > .ic-Dashboard-header')
  dashboard.insertBefore(overview, nativeHeader || dashboard.querySelector(':scope > #dashboard-planner') || null)
  applyLanguage()
  dashboard.classList.add('mist-native-hidden')
  toggle.onclick = () => {
    const cards = dashboard.classList.toggle('mist-native-hidden')
    grid.hidden = !cards
    translate(heading,cards ? 'My courses' : 'Dashboard',cards ? '我的课程' : '控制面板')
    translate(toggle,cards ? 'Canvas dashboard' : 'Course cards',cards ? '查看原控制面板' : '返回课程卡片')
  }

  const slots = new Map()
  function arrangeCards() {
    const tier = slot => focused.has(slot.id) ? 0 : slot.orientation ? 2 : 1
    const ordered = [...slots.values()].sort((a,b) =>
      tier(a) - tier(b) || (a.nextDue - b.nextDue) ||
      (Number(b.academic) - Number(a.academic))
    )
    const firstActivity = ordered.find(slot => tier(slot) === 2)
    for (const slot of ordered) {
      slot.card.classList.toggle('mist-start-row', slot === firstActivity)
      grid.append(slot.card)
    }
  }
  for (const course of courses) {
    const path = '/courses/' + encodeURIComponent(course.id)
    const card = element('article', null, 'mist-course')
    const cover = element('div', null, 'mist-cover')
    const setCover = source => {
      if (!source) return
      const url = URL.parse(source, location.origin)
      if (url?.protocol !== 'https:') return
      const image = element('img')
      image.alt = ''
      image.loading = 'lazy'
      image.onerror = () => image.remove()
      image.src = url.href
      cover.replaceChildren(image)
    }
    setCover(course.image_download_url || course.image_url)
    const top = element('div', null, 'mist-course-top')
    const pattern = /\b[A-Z]{3,5}[ -]?\d{3}[A-Z]?\b/i
    const code = course.course_code?.match(pattern)?.[0] || course.name.match(pattern)?.[0]
    const name = course.name.split(/:\s+/).pop() || course.name
    if (code) top.append(element('span',code,'mist-code'))
    const title = element('h2')
    const courseLink = link(name,path)
    courseLink.title = course.name
    title.append(courseLink)
    top.append(title)
    const metrics = element('div',null,'mist-metrics')
    const enrollment = course.enrollments?.find(e => e.type === 'student' || e.type === 'StudentEnrollment')
    const score = enrollment?.computed_current_score
    const grade = link(null,path+'/grades')
    grade.append(labelNode('span','Current grade','当前成绩'),score != null || enrollment?.computed_current_grade ? element('strong',score != null ? score+'%' : enrollment.computed_current_grade) : labelNode('strong','No grade','暂无成绩'))
    const inbox = link(null,'/conversations?scope=unread&filter='+encodeURIComponent('course_'+course.id))
    const unread = labelNode('strong','Loading…','读取中…')
    inbox.append(labelNode('span','Unread threads','未读会话'),unread)
    metrics.append(grade,inbox)
    const work = element('div',null,'mist-work')
    const label = labelNode('h3','Due in 48 hours','未来 48 小时作业')
    const list = element('ul')
    list.append(labelNode('li','Loading…','读取中…'))
    work.append(label,list)
    card.append(cover,top,metrics,work)
    const academic = Boolean(code || score != null || enrollment?.computed_current_grade)
    const id = String(course.id)
    const star = element('button', null, 'mist-focus')
    star.type = 'button'
    translate(star,'★ Focus','★ 重点关注')
    top.prepend(star)
    star.setAttribute('aria-pressed',String(focused.has(id)))
    star.onclick = () => {
      if (focused.has(id)) focused.delete(id)
      else focused.add(id)
      chrome.storage.local.set({focusCourses:[...focused]})
      star.setAttribute('aria-pressed',String(focused.has(id)))
      arrangeCards()
      star.focus()
    }
    const orientation = /\borientation\b|\bonboarding\b|\bwelcome week\b|迎新|入学指导|新生入学/i.test([course.name,course.original_name,course.course_code].join(' '))
    slots.set(id,{id,card,academic,orientation,nextDue:Infinity,unread,list,setCover})
  }

  arrangeCards()

  // Extension-owned callers can request course material from this dashboard tab.
  chrome.runtime.onMessage.addListener((request, sender, respond) => {
    if (sender.id !== chrome.runtime.id || request?.type !== 'mist.course.read.v1') return
    const id = String(request.courseId)
    async function read() {
      if (!slots.has(id)) throw Error('Unknown course')
      const base = '/api/v1/courses/'+encodeURIComponent(id)
      if (request.resource === 'pages') {
        return (await pages(base+'/pages?per_page=100')).map(({url,title}) => ({url,title}))
      }
      if (request.resource === 'page' && typeof request.slug === 'string' && /^[^/?.#]+$/.test(request.slug)) {
        const res = await fetch(base+'/pages/'+encodeURIComponent(request.slug),{headers:{Accept:'application/json'}})
        if (!res.ok) throw Error('Page unavailable')
        const {title,body} = await res.json()
        return {title,html:body}
      }
      if (request.resource === 'assignments') {
        return (await pages(base+'/assignments?per_page=100')).map(({id,name,due_at,description}) => ({id,name,due_at,html:description}))
      }
      throw Error('Unsupported resource')
    }
    read().then(data=>respond({ok:true,data}),error=>respond({ok:false,error:error.message}))
    return true
  })

  const now = new Date()
  const detailUntil = now.getTime() + 48 * 60 * 60 * 1000
  const end = new Date(now)
  end.setDate(end.getDate()+7)
  const params = new URLSearchParams({start_date:now.toISOString(),end_date:end.toISOString(),per_page:'100'})
  await Promise.all([
    (async () => {
      try {
        const cards = await pages('/api/v1/dashboard/dashboard_cards')
        for (const card of cards) slots.get(String(card.id))?.setCover(card.image)
      } catch { /* Course-list covers remain available. */ }
    })(),
    (async () => {
      try {
        const messages = await pages('/api/v1/conversations?scope=unread&per_page=100')
        const counts = new Map()
        for (const message of messages) counts.set(message.context_code,(counts.get(message.context_code)||0)+1)
        for (const [id,slot] of slots) translate(slot.unread, counts.get('course_'+id)||0, counts.get('course_'+id)||0)
      } catch { for (const slot of slots.values()) translate(slot.unread,'Unavailable','暂不可用') }
    })(),
    (async () => {
      try {
        const items = await pages('/api/v1/planner/items?'+params)
        const byCourse = new Map()
        for (const item of items) {
          if (!['assignment','quiz','discussion_topic','sub_assignment','assessment_request'].includes(item.plannable_type)) continue
          const due = new Date(item.plannable?.due_at || item.plannable_date)
          if (!(due >= now && due < end)) continue
          const id = String(item.course_id)
          if (!byCourse.has(id)) byCourse.set(id,[])
          byCourse.get(id).push({item,due})
        }
        for (const [id,slot] of slots) {
          const work = (byCourse.get(id) || []).sort((a,b) => a.due-b.due)
          const pending = work.filter(({item}) => item.submissions?.submitted !== true)
          slot.nextDue = pending[0]?.due.getTime() ?? Infinity
          slot.list.replaceChildren()
          const soon = work.filter(({due}) => due < detailUntil)
          const later = pending.filter(({due}) => due >= detailUntil).length
          if (!soon.length) slot.list.append(labelNode('li','Nothing due','暂无到期作业'))
          for (const {item,due} of soon.sort((a,b)=>Number(a.item.submissions?.submitted === true)-Number(b.item.submissions?.submitted === true))) {
            const row = element('li')
            const name = element('span',null,'mist-work-name')
            name.append(link(item.plannable.title,item.html_url))
            row.append(name)
            if (item.submissions?.submitted === true) {
              const badge = element('span',null,'mist-submitted')
              const tick = element('span','✓')
              tick.setAttribute('aria-hidden','true')
              const status = labelNode('span','Submitted','已提交')
              status.className = 'screenreader-only'
              badge.append(tick,status)
              row.append(badge)
            } else {
              row.className = 'mist-pending'
              const time = element('time')
              time.dateTime = due.toISOString()
              formatTime(time)
              row.append(time)
            }
            slot.list.append(row)
          }
          if (later) {
            const summary = labelNode('li',later+' more due within 7 days','7 天内另有 '+later+' 项到期')
            summary.className = 'mist-pending'
            slot.list.append(summary)
          }
        }
        arrangeCards()
      } catch { for (const slot of slots.values()) slot.list.replaceChildren(labelNode('li','Assignments unavailable','作业暂不可用')) }
    })()
  ])
})()
