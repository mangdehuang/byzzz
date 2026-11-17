// 按原图元属性类型建立规则行，避免通用表格新增行后丢失专用字段。
export function ruleTemplate(field) {
  const type = field.attrType || ''
  if (/hardwareInput/i.test(type)) return { key: '', name: '' }
  if (/whereStatusSwitch/i.test(type)) return { description: '', status: '', command: '', icon: '' }
  if (/imagesStatus/i.test(type)) return { status: '', icon: '' }
  if (/rotateTable/i.test(type)) return { directionRotation: '', min: '', max: '' }
  if (/whereSelect/i.test(type)) return { direction: '', min: '', max: '' }
  if (/whereStatusTable/i.test(type)) return { description: '', min: '', max: '', color: '', fill: '' }
  if (/whereStatusColor/i.test(type)) return { color: '', min: '', max: '' }
  if (/gearConfig/i.test(type)) return { name: '', value: '', cmd: '' }
  if (/ON_OFFSTATETable/i.test(type)) return { textState: '', color: '', min: '', max: '' }
  if (/subsectionColor/i.test(type)) return { value: '', color: '' }
  if (/valueZoom/i.test(type)) return { zoomSize: '1', decimalDigits: '0' }
  if (/DataKeyArrayTableColor/i.test(type)) return { key: '', name: '', color: '' }
  if (/DataKeyArrayTableFixed/i.test(type)) return { key: '', name: '', description: '' }
  if (/dataKey|sendKey|TableField|urlParam/i.test(field.attrCode) || /DataKeyArrayTable/i.test(type)) return { key: '', name: '' }
  return { devicecode: '', devicename: '', min: '', max: '' }
}
