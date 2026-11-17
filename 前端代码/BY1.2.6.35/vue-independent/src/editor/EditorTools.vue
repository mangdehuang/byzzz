<script setup>
import { ElButton, ElButtonGroup, ElTooltip } from 'element-plus'

defineProps({ zoom: Number, saving: Boolean, template: String })
const emit = defineEmits(['action'])
const groups = [
  [['undo','撤销（Ctrl+Z）','top1.png'],['redo','恢复（Ctrl+Y）','top2.png'],['copy','复制（Ctrl+V）','top3.png']],
  [['up','上移一层','top5.png'],['down','下移一层','top4.png'],['front','置于顶层','top6.png'],['back','置于底层','top7.png']],
  [['left','左对齐','top8.png'],['right','右对齐','top9.png'],['top','上对齐','top10.png'],['bottom','下对齐','top11.png'],
    ['horizontal','水平居中','top12.png'],['vertical','垂直居中','top13.png'],['delete','删除','top14.png']],
]
</script>

<template>
  <header class="toolbar" aria-label="画面工具栏">
    <div class="tools">
      <ElButtonGroup v-for="(group, index) in groups" :key="index">
        <ElTooltip v-for="[key, label, icon] in group" :key="key" :content="label" :show-after="350">
          <ElButton :aria-label="label" size="small" @click="emit('action', key)">
            <img :src="'/byzt/config/icon/' + icon" alt="">
          </ElButton>
        </ElTooltip>
      </ElButtonGroup>
    </div>
    <div class="tools right">
      <ElButton size="small" @click="emit('action','open')">打开画面</ElButton>
      <ElButton id="config_dummy_variable" size="small" @click="emit('action','variables')">虚拟变量</ElButton>
      <ElButton id="full" size="small" @click="emit('action','fullscreen')">全屏</ElButton>
      <span id="stageProportion">{{ Math.round(zoom * 100) }}%</span>
      <ElButtonGroup>
        <ElButton size="small" aria-label="放大" @click="emit('action','zoom-in')">＋</ElButton>
        <ElButton size="small" aria-label="缩小" @click="emit('action','zoom-out')">－</ElButton>
        <ElButton size="small" aria-label="还原" @click="emit('action','zoom-reset')">还原</ElButton>
      </ElButtonGroup>
      <ElButton id="yl" size="small" @click="emit('action','preview')">预览</ElButton>
      <ElButton id="bcmb" size="small" @click="emit('action','template')">{{ template ? '修改到模板' : '保存到模板' }}</ElButton>
      <ElButton id="bc" size="small" type="primary" :loading="saving" @click="emit('action','save')">保存</ElButton>
    </div>
  </header>
</template>

<style scoped lang="less">
.toolbar { display: flex; flex-wrap: wrap; flex: 0 0 auto; gap: var(--ui-space-2) var(--ui-space-4); padding: var(--ui-space-2) var(--ui-space-3); background: var(--ui-surface-muted); border-bottom: 1px solid var(--ui-border); }
.tools { display: flex; flex-wrap: wrap; gap: var(--ui-space-2); align-items: center; min-width: 0; }
.right { margin-left: auto; }
.tools img { width: 16px; height: 16px; object-fit: contain; }
.tools .el-button + .el-button { margin-left: 0; }
#stageProportion { min-width: 40px; color: var(--ui-text-secondary); font-variant-numeric: tabular-nums; text-align: center; }
</style>
