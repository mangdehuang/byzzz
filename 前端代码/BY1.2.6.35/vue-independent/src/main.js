import { createApp, h } from 'vue'
import { ElConfigProvider, ElResult } from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import './styles.less'

const path = location.pathname
const edit = ['/', '/index.html', '/byzt/', '/byzt/index_edit.html'].includes(path)
const preview = path === '/byzt/preview.html'
const monitor = path === '/byzt/client_view.html'
const App = edit
  ? (await import('./editor/EditorPage.vue')).default
  : preview || monitor
    ? (await import('./viewer/ViewerPage.vue')).default
    : () => h(ElResult, { icon: 'warning', title: '页面不存在' })

document.title = edit ? '组态编辑器' : preview ? '画面预览' : '实时监控'
createApp({
  render: () => h(ElConfigProvider, { locale: zhCn }, () => h(App, { preview })),
}).mount('#app')
