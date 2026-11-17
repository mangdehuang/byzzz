import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer as createPortServer } from 'node:net'
import { createServer as createViteServer } from 'vite'
import assert from 'node:assert/strict'
const require = createRequire(import.meta.url)
// Playwright 由执行环境提供，不向业务项目新增依赖。
const { chromium } = require(process.env.BY_PLAYWRIGHT_MODULE || 'playwright')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
process.chdir(root)
const temporary = mkdtempSync(join(tmpdir(), 'byzt-preview-'))
const binary = join(temporary, 'byzt-go')
const backend = resolve(root, '../../后端代码Go')
const built = spawnSync('go', ['build', '-o', binary, '.'], { cwd: backend, stdio: 'inherit' })
assert.equal(built.status, 0, 'Go verification server build failed')
const probe = createPortServer()
await new Promise(done => probe.listen(0, '127.0.0.1', done))
const port = probe.address().port
await new Promise(done => probe.close(done))
const apiBase = 'http://127.0.0.1:' + port
// 独立数据库和端口；不读取/修改用户业务数据、不使用设备令牌。
const child = spawn(binary, [], { cwd: backend, env: { ...process.env, BY_LISTEN: '127.0.0.1:' + port,
  BY_DB_PATH: join(temporary, 'preview.sqlite'), BY_INTEGRATION_TOKEN: '',
  BY_VUE_DIR: join(root, 'dist-independent/byzt') }, stdio: 'ignore' })
let vite
let browser
try {
  let ready = false
  for (let attempt = 0; attempt < 100; attempt++) {
    try { ready = (await fetch(apiBase + '/byzt/config/init.json')).ok } catch {}
    if (ready) break
    await new Promise(done => setTimeout(done, 100))
  }
  assert.equal(ready, true, '先运行 pnpm build，确认 Go 可读取独立构建')
  vite = await createViteServer({ configFile: join(root, 'vite.independent.config.js'), server: {
    port: 0, open: false, proxy: { '^/(ims|ztgl|api|byzt-media)(/|$)': { target: apiBase, changeOrigin: false },
      '/websocket': { target: apiBase, ws: true, changeOrigin: false } },
  } })
  await vite.listen()
  const base = 'http://127.0.0.1:' + vite.httpServer.address().port
  mkdirSync(join(root, 'docs/parity-evidence'), { recursive: true })
const catalog = JSON.parse(readFileSync('vue-independent/public/byzt/config/module_config_base.json')).flatMap(x=>x.moduleItem)
const model = type => structuredClone(catalog.find(x=>x.moduleJson.attrs.moduleType===type).moduleJson)
const scene = {className:'Stage',attrs:{width:1000,height:650,isForcedRotation:'0',isStageMove:'1',IsBackgroundFull:'1',dummyVarList:[],webSocket:{webSocketIsOn:0},mqtt:{mqttIsOn:0}},children:[{className:'Layer',attrs:{name:'layer_grid'},children:[{className:'Rect',attrs:{name:'layer_background',width:1000,height:650,fill:'#eef3f8',listening:false}}]},{className:'Layer',attrs:{},children:[]},{className:'Layer',attrs:{name:'layer_three'},children:[]}]}
const group=(id,x,y,text,attrs={})=>({className:'Group',attrs:{id,moduleType:'lableText',x,y,name:'jyzt_module_group',...attrs},children:[{className:'Rect',attrs:{width:170,height:65,fill:'#d7e8fb',cornerRadius:4}},{className:'Text',attrs:{text,fontSize:18,x:12,y:22}}]})
const nodes=scene.children[1].children
nodes.push(group('hover',40,100,'悬停信息',{basicInfo:{showType:'1',showContent:[{title:'功率',type:'2',value:{devicecode:'power'},unit:'kW'}]}}))
nodes.push(group('click',240,100,'单击信息',{basicInfo:{showType:'2',showContent:[{title:'状态',type:'4',value:{key:{devicecode:'state'},state:[{value:0,text:'停止'}]}}]}}))
nodes.push(group('popup',440,100,'点击弹窗',{clickInfo:{clickType:'1',urlContent:'/preview-detail?key=',contentWidth:400,contentHeight:260},urlParam:[{key:'power'}]}))
nodes.push(group('menu',640,100,'右键菜单',{rightMenu:{isEnable:'1',menuContent:[{title:'查看详情',url:'/preview-detail?key=',width:420,height:260}]},dataKey:[{key:'power'}]}))
nodes.push(group('control',40,230,'设备控制',{moduleType:'BUTTON',dataKey:[{key:'relay'}],clickWhere:[{code:'1',content:0}]}))
const input=model('INPUT_FORM');Object.assign(input.attrs,{id:'input',x:240,y:230,width:170,height:60,basicInfo:{showType:'2',showContent:[{title:'HTML图元',type:'1',value:'单击信息正常'}]},rightMenu:{isEnable:'1',menuContent:[{title:'输入详情',url:'/preview-detail?key=',width:400,height:240}]}});nodes.push(input)
const value=model('VALUE');Object.assign(value.attrs,{id:'value',x:680,y:235,dataKey:[{key:'power'}],defaultValue:'等待数据',unit:'kW'});nodes.push(value)
nodes.push({className:'Group',attrs:{id:'path',moduleType:'TRACKLINE',sourceId:'moving',x:50,y:420},children:[{className:'Line',attrs:{name:'trackHLine',points:[0,0,250,0,250,100],stroke:'#5685ae',strokeWidth:2}}]})
nodes.push(group('moving',65,430,'路径移动',{pathAminMethodCall:'pathAminModule',Hmove:'1',trackHid:'path',HdataKey:[{key:'distance'}],Hscope:{min:0,max:100},HinitPosition:0,seppd:350,HpathHide:'2'}))
const response=await fetch(apiBase+'/ims/scene',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({stageName:'预览迁移验收',stagedatajson:JSON.stringify(scene)})});const saved=await response.json();assert.equal(saved.code,200);const id=saved.data.id
browser=await chromium.launch({headless:true})
const context=await browser.newContext({viewport:{width:1200,height:800}})
await context.route('**/preview-detail?*',route=>route.fulfill({contentType:'text/html',body:'<html><body>详情页已加载</body></html>'}))
const page=await context.newPage();const errors=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));page.on('pageerror',e=>errors.push(e.message))
const checks=[];const ok=name=>{checks.push(name);console.log('PASS',name)}
const engine=async(p,expression)=>p.evaluate(expression=>{const vm=document.querySelector('.viewer').__vueParentComponent;return Function('engine','return '+expression)(vm.setupState.engine)},expression)
const point=async(p,id)=>{const d=await engine(p,`({position:engine.stage.findOne('#${id}').absolutePosition(),size:engine.stage.size()})`);const box=await p.locator('.stage').boundingBox();return {x:box.x+(d.position.x+40)*box.width/d.size.width,y:box.y+(d.position.y+30)*box.height/d.size.height}}
const click=async(p,id,options)=>{const q=await point(p,id);await p.mouse.click(q.x,q.y,options)}
const move=async(p,id)=>{const q=await point(p,id);await p.mouse.move(q.x,q.y)}
const send=async(p,raw)=>{await p.getByRole('textbox',{name:'预览测试数据'}).fill(raw);await p.getByRole('button',{name:'发送测试数据',exact:true}).click()}
try {
await page.goto(`${base}/byzt/?id=${id}&project=42`);await page.getByRole('button',{name:'预览',exact:true}).waitFor()
// 直接检查实际计算样式和面板高度，避免仅检查 CSS 文本。
for (const width of [1440, 1024]) {
  await page.setViewportSize({width,height:900})
  await page.waitForTimeout(100)
  const toolbar=await page.locator('.toolbar').evaluate(node=>({width:node.clientWidth,scroll:node.scrollWidth}))
  assert.ok(toolbar.scroll<=toolbar.width+1,'编辑工具栏应按组换行而非挤压控件')
  const control=await page.getByRole('button',{name:'预览',exact:true}).evaluate(node=>({font:getComputedStyle(node).fontSize,height:node.getBoundingClientRect().height}))
  assert.equal(control.font,'14px');assert.equal(control.height,32)
}
await page.locator('.asset-tile').first().waitFor()
assert.equal(await page.locator('.asset-tile').first().evaluate(node=>getComputedStyle(node).fontSize),'12px')
await page.setViewportSize({width:1024,height:600});await page.getByRole('tab',{name:'画布',exact:true}).click()
await page.waitForTimeout(100)
const selectStyle=await page.locator('.inspector .el-tab-pane:visible .el-select__wrapper').first().evaluate(node=>({height:node.getBoundingClientRect().height,font:getComputedStyle(node).fontSize}));assert.equal(selectStyle.height,32);assert.equal(selectStyle.font,'14px');
const scroll=await page.locator('.inspector .el-tab-pane:visible .el-scrollbar__wrap').evaluate(node=>({height:node.clientHeight,content:node.scrollHeight}))
assert.ok(scroll.height>100&&scroll.content>scroll.height,'画布设置应在属性面板内滚动')
await page.screenshot({path:root+'/docs/parity-evidence/ui-editor-20261117.png'})
await page.getByRole('button',{name:'快捷键',exact:true}).click();await page.getByRole('dialog').waitFor()
assert.equal(await page.locator('.el-dialog__title').evaluate(node=>getComputedStyle(node).fontSize),'18px')
await page.locator('.el-dialog__headerbtn').click();await page.getByRole('dialog').waitFor({state:'hidden'})
ok('显示规范：14px操作、12px辅助、18px标题、32px控件及面板滚动')
const popupEvent=page.waitForEvent('popup');await page.getByRole('button',{name:'预览',exact:true}).click();const preview=await popupEvent;await preview.waitForLoadState();await preview.locator('.stage canvas').first().waitFor();await preview.waitForFunction(()=>!document.querySelector('.viewer-loading'))
assert.equal(new URL(preview.url()).searchParams.get('project'),'42');assert.equal(new URL(preview.url()).searchParams.has('id'),false);ok('编辑器草稿新窗口与URL参数传递')
await preview.reload();await preview.locator('.stage canvas').first().waitFor();assert.equal(await engine(preview,'engine.groups().length'),nodes.length);ok('预览刷新保留草稿')
await move(preview,'hover');await preview.getByRole('tooltip').waitFor();assert.match(await preview.getByRole('tooltip').innerText(),/—/);ok('缺失点位显示占位')
await send(preview,'{power:0,state:0,distance:100}');await move(preview,'hover');await preview.getByRole('tooltip').waitFor();assert.match(await preview.getByRole('tooltip').innerText(),/0kW/);ok('JSON5测试数据与真实零值')
await move(preview,'click');assert.equal(await preview.getByRole('tooltip').count(),0);await click(preview,'click');await preview.getByRole('tooltip').waitFor();assert.match(await preview.getByRole('tooltip').innerText(),/停止/);ok('单击信息不被悬停触发')
await click(preview,'popup');await preview.getByRole('dialog').waitFor();assert.match(await preview.locator('iframe[title="组态弹窗"]').getAttribute('src'),/power@/);await preview.locator('.el-dialog__headerbtn').click();await preview.getByRole('dialog').waitFor({state:'hidden'});ok('点击弹窗与旧参数约定')
await click(preview,'menu',{button:'right'});await preview.getByRole('menuitem',{name:'查看详情'}).click();await preview.getByRole('dialog').waitFor();await preview.locator('.el-dialog__headerbtn').click();await preview.getByRole('dialog').waitFor({state:'hidden'});ok('Canvas右键菜单打开详情')
await preview.locator('[data-widget="INPUT_FORM"] input').click();await preview.getByRole('tooltip').waitFor();assert.match(await preview.getByRole('tooltip').innerText(),/HTML图元/);await preview.locator('[data-widget="INPUT_FORM"]').click({button:'right'});await preview.getByRole('menuitem',{name:'输入详情'}).waitFor();await preview.keyboard.press('Escape');assert.equal(await preview.getByRole('menu').count(),0);ok('HTML图元单击信息、右键与Escape关闭')
await click(preview,'control');await preview.getByText('预览模式下不发送设备指令',{exact:true}).waitFor();ok('预览阻止设备指令')
await preview.waitForFunction(()=>document.querySelector('.viewer').__vueParentComponent.setupState.engine.stage.findOne('#moving').x()===315);assert.equal(await engine(preview,"engine.stage.findOne('#moving').y()"),530);ok('路径末端与图元偏移')
await send(preview,'{distance:0}');await preview.waitForFunction(()=>document.querySelector('.viewer').__vueParentComponent.setupState.engine.stage.findOne('#moving').x()===65);ok('路径反向回程')
const before=await preview.locator('.stage').getAttribute('style');const q=await point(preview,'control');await preview.mouse.move(q.x,q.y);await preview.mouse.down();await preview.mouse.move(q.x+80,q.y+60,{steps:10});await preview.mouse.up();assert.notEqual(await preview.locator('.stage').getAttribute('style'),before);await preview.getByRole('button',{name:'还原',exact:true}).click();assert.equal(await preview.locator('.stage').getAttribute('style'),before);ok('无需Alt拖动与还原')
await preview.mouse.move(700,600);await preview.mouse.wheel(0,-150);await preview.waitForTimeout(100);assert.notEqual(await preview.locator('.stage').getAttribute('style'),before);await preview.getByRole('button',{name:'还原',exact:true}).click();ok('滚轮缩放与还原')
await preview.getByRole('button',{name:'全屏',exact:true}).click();await preview.getByRole('button',{name:'退出全屏',exact:true}).waitFor();await preview.getByRole('button',{name:'退出全屏',exact:true}).click();await preview.getByRole('button',{name:'全屏',exact:true}).waitFor();ok('全屏状态与退出')
await preview.getByRole('textbox',{name:'预览测试数据'}).fill('not-json');await preview.getByRole('button',{name:'发送测试数据'}).click();await preview.getByText('请输入点位和值的 JSON 对象',{exact:true}).waitFor();ok('无效数据提示')
await send(preview,'{power:0,state:0,distance:40}');await preview.waitForFunction(()=>!document.querySelector('.el-message'));await preview.screenshot({path:root+'/docs/parity-evidence/preview-desktop-20261117.png'});
for(const viewport of [{width:390,height:844},{width:844,height:390},{width:320,height:568}]){await preview.setViewportSize(viewport);await preview.waitForTimeout(200);const toolbar=await preview.getByRole('toolbar').boundingBox();assert.ok(toolbar.x>=0&&toolbar.x+toolbar.width<=viewport.width);const inputBox=await preview.getByRole('textbox',{name:'预览测试数据'}).boundingBox();assert.ok(inputBox.width>(viewport.width<=600 ? viewport.width-60 : 120));
const sendBox=await preview.getByRole('button',{name:'发送测试数据'}).boundingBox();if(viewport.width<=600){assert.ok(inputBox.y>=sendBox.y+sendBox.height);}else{assert.ok(inputBox.y<=sendBox.y+2);}assert.equal(await engine(preview,"engine.stage.findOne('#value').findOne('.complexTextValue').text()"),'0');}
ok('320/390窄屏与横屏适配且点位不丢失');
await preview.locator('[data-widget="INPUT_FORM"] input').fill('用户草稿');await preview.setViewportSize({width:844,height:390});assert.equal(await preview.locator('[data-widget="INPUT_FORM"] input').inputValue(),'用户草稿');ok('输入框草稿在朝向变化后保持');
await preview.setViewportSize({width:390,height:844});
// 强制旋转场景使用同一业务画面重新加载，不改当前用户数据库。
scene.attrs.isForcedRotation='1';const rotateSaved=await (await fetch(apiBase+'/ims/scene',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({stageName:'预览旋转验收',stagedatajson:JSON.stringify(scene)})})).json();const rotate=await context.newPage();await rotate.setViewportSize({width:390,height:844});await rotate.goto(base+'/byzt/preview.html?id='+rotateSaved.data.id);await rotate.locator('.stage canvas').first().waitFor();assert.match(await rotate.locator('.stage').getAttribute('style'),/rotate\(90deg\)/);await rotate.setViewportSize({width:844,height:390});await rotate.waitForTimeout(100);assert.doesNotMatch(await rotate.locator('.stage').getAttribute('style'),/rotate\(90deg\)/);ok('横画面强制旋转与横屏恢复');await preview.screenshot({path:root+'/docs/parity-evidence/preview-mobile-20261117.png'});
// 用实际加载失败再重试验证局部状态，接口只在本次浏览器中截断一次。
const failure=await context.newPage();await failure.route('**/ims/scene/'+id,route=>route.fulfill({status:503,contentType:'application/json',body:'{"code":503}'}),{times:1});await failure.goto(`${base}/byzt/preview.html?id=${id}`);await failure.getByText('画面无法加载',{exact:true}).waitFor();await failure.getByRole('button',{name:'重新加载'}).click();await failure.locator('.stage canvas').first().waitFor();ok('画面加载失败后重试恢复')
// 覆盖全部基础图元和异步图表/媒体分支；外部业务接口留空，验证真实空态。
const all = structuredClone(scene)
all.attrs.width=2400;all.attrs.height=1800;all.attrs.isForcedRotation='0'
all.children[0].children[0].attrs.width=2400;all.children[0].children[0].attrs.height=1800
all.children[1].children=catalog.map((item,index)=>{
  const node=structuredClone(item.moduleJson)
  Object.assign(node.attrs,{id:'catalog-'+index,x:index%10*240+15,y:Math.floor(index/10)*175+30,
    interface_address:'',liveSrc:'',iframeSrc:'',deviceSerial:'',accessToken:'',appKey:'',appSecret:''})
  return node
})
const allSaved=await (await fetch(apiBase+'/ims/scene',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({stageName:'百项预览验收',stagedatajson:JSON.stringify(all)})})).json()
const allPage=await context.newPage();await allPage.setViewportSize({width:1600,height:1200});await allPage.goto(base+'/byzt/preview.html?id='+allSaved.data.id)
await allPage.locator('.stage canvas').first().waitFor()
await allPage.waitForFunction(()=>document.querySelector('.viewer').__vueParentComponent.setupState.engine?.groups().length===100)
const chartCount=catalog.filter(item=>item.moduleJson.attrs.moduleType.startsWith('ECHART_')).length
await allPage.locator('.chart-host').nth(chartCount-1).waitFor()
assert.equal(await allPage.locator('.chart-host').count(),chartCount)
// 无数据的空饼图可以没有 Canvas 图层；发送真实零值后再核对全部图表渲染。
await send(allPage,'{power:0}')
await allPage.locator('.chart-host canvas').nth(chartCount-1).waitFor()
await allPage.waitForTimeout(250)
assert.equal(await allPage.getByText('暂无数据',{exact:true}).count(),0)
await allPage.screenshot({path:root+'/docs/parity-evidence/preview-catalog-20261117.png'})
ok('全部100个基础图元与15种图表零值预览加载')
assert.deepEqual(errors,[]);ok('所有受测页面无未处理浏览器错误')
writeFileSync(root+'/docs/parity-evidence/preview-browser-20261117.json',JSON.stringify({date:'2026-11-17',environment:'Vite + Go临时SQLite；无现场设备',checks,errors},null,2));
} finally { await browser?.close() }
} finally {
  await vite?.close()
  child.kill('SIGTERM')
  await new Promise(done => child.exitCode !== null ? done() : child.once('exit', done))
  rmSync(temporary, { recursive: true, force: true })
}
