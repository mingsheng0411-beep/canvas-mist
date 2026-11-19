# Canvas Mist · 雾白

![Canvas Mist icon](icon-48.png)

Canvas Mist is a student-built Chrome extension for UMD Canvas. Course cards show grades, unread conversations and upcoming deadlines, with focused courses first. The three-week calendar links directly to assignments and quizzes. The interface supports English and Chinese.

## Install in Chrome

1. [Download the extension](https://github.com/mingsheng0411-beep/canvas-mist/archive/refs/heads/main.zip) and extract it to a folder you plan to keep.
2. Open `chrome://extensions` in desktop Chrome and enable **Developer mode**.
3. Click **Load unpacked** and select the extracted folder containing `manifest.json`.
4. Sign in to [UMD Canvas](https://umd.instructure.com/) and refresh your dashboard.

To update, replace the files in the installed folder with the latest download, click **Reload** on the extension card and refresh Canvas.

## 中文安装说明

下载并解压上方的 ZIP。在电脑 Chrome 打开 `chrome://extensions`，开启「开发者模式」，点「加载已解压的扩展程序」，选择包含 `manifest.json` 的文件夹。登录 UMD Canvas 并刷新即可。控制面板顶部可切换中文或英文，课程卡片上的星标可将课程置顶。

## Data access

The extension reads Canvas data using your existing UMD session and stores language and focus preferences in Chrome. The [course reader interface](COURSE-API.md) is available to extension components. Canvas Mist is an independent project, unaffiliated with UMD or Instructure.
