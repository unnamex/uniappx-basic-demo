const fs = require('fs');
const JSZip = require('jszip');

(async () => {
  const buf = fs.readFileSync('tmp/srd_gen/test_package_v4_breadcrumb.srd');
  const zip = await JSZip.loadAsync(buf);

  // 读取工艺数据
  const procKey = Object.keys(zip.files).find(k => k.includes('proc_v8_engine'));
  const procTxt = await zip.file(procKey).async('string');
  const proc = JSON.parse(procTxt);

  // 使用本地静态资源路径（运行时可用）
  const logoImg = '/static/logo.png';
  const processIcon = '/static/icons/process.svg';
  const procedureIcon = '/static/icons/procedure.svg';

  // 工序1: 缸体组装 — 富文本包含表格、图片、颜色、下划线
  proc.children[0].description_html = '<div style="font-family:sans-serif;font-size:14px;line-height:1.6;">'
    + '<h3 style="color:#1a1a2e;border-bottom:2px solid #0891b2;padding-bottom:6px;">缸体组装工序操作指引</h3>'
    + '<p><span style="color:#f56c6c;font-weight:bold;font-size:16px;">⚠ 重要安全提示：</span>'
    + '操作前必须确认工位<span style="text-decoration:underline;color:#e6a23c;">已断电</span>，'
    + '佩戴<span style="color:#409eff;font-weight:bold;">防护手套</span>和'
    + '<span style="color:#409eff;font-weight:bold;">护目镜</span>。</p>'
    + '<p>缸体组装工序负责完成<span style="text-decoration:underline;color:#007aff;">缸体</span>、'
    + '<span style="text-decoration:underline;color:#007aff;">活塞</span>、'
    + '<span style="text-decoration:underline;color:#007aff;">曲轴</span>等核心零部件的装配，'
    + '是整个发动机装配中<span style="color:#e6a23c;font-weight:bold;">最关键的工序</span>。</p>'
    + '<p style="margin:8px 0;"><img src="' + logoImg + '" width="80" style="vertical-align:middle;" />'
    + ' <span style="color:#909399;font-size:12px;">工艺标识</span></p>'
    + '<h4 style="color:#303133;">螺栓扭矩参数表</h4>'
    + '<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;border-color:#dcdfe6;width:100%;font-size:13px;">'
    + '<tr style="background-color:#f0f2f5;">'
    + '<th style="color:#303133;text-align:left;">紧固部位</th>'
    + '<th style="color:#303133;text-align:center;">扭矩(Nm)</th>'
    + '<th style="color:#303133;text-align:center;">精度等级</th></tr>'
    + '<tr><td>主轴承盖螺栓</td>'
    + '<td style="text-align:center;color:#e6a23c;font-weight:bold;">65±3</td>'
    + '<td style="text-align:center;">A级</td></tr>'
    + '<tr style="background-color:#fafafa;"><td>连杆螺栓</td>'
    + '<td style="text-align:center;color:#e6a23c;font-weight:bold;">45±2</td>'
    + '<td style="text-align:center;">A级</td></tr>'
    + '<tr><td>飞轮螺栓</td>'
    + '<td style="text-align:center;color:#e6a23c;font-weight:bold;">90±5</td>'
    + '<td style="text-align:center;">B级</td></tr></table>'
    + '<p style="margin-top:8px;"><span style="background-color:#ecf5ff;color:#409eff;padding:2px 6px;border-radius:3px;">提示</span>'
    + ' 所有扭矩值需使用<span style="text-decoration:underline;">已校准的扭力扳手</span>进行操作。</p>'
    + '</div>';

  // 工序2: 缸盖组装 — 富文本包含步骤列表、颜色标注
  proc.children[1].description_html = '<div style="font-family:sans-serif;font-size:14px;line-height:1.6;">'
    + '<h3 style="color:#1a1a2e;border-bottom:2px solid #67c23a;padding-bottom:6px;">缸盖组装工序操作规范</h3>'
    + '<p style="color:#67c23a;font-weight:bold;">本工序属于 '
    + '<span style="background-color:#f0f9eb;padding:2px 8px;border-radius:3px;">A级工装控制</span> 范畴</p>'
    + '<p>缸盖组装工序负责<span style="text-decoration:underline;color:#303133;font-weight:bold;">缸垫</span>、'
    + '<span style="text-decoration:underline;color:#303133;font-weight:bold;">缸盖</span>、'
    + '<span style="text-decoration:underline;color:#303133;font-weight:bold;">凸轮轴</span>及'
    + '<span style="text-decoration:underline;color:#303133;font-weight:bold;">正时系统</span>的安装，'
    + '直接影响发动机配气性能。</p>'
    + '<p style="margin:8px 0;"><img src="' + procedureIcon + '" width="40" style="vertical-align:middle;" />'
    + ' <span style="color:#909399;font-size:12px;">工序标识</span></p>'
    + '<h4 style="color:#303133;">螺栓紧固顺序（对角线法）</h4>'
    + '<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;border-color:#dcdfe6;width:100%;font-size:13px;">'
    + '<tr style="background-color:#f0f2f5;">'
    + '<th style="text-align:left;color:#303133;">紧固阶段</th>'
    + '<th style="text-align:center;color:#303133;">目标扭矩</th>'
    + '<th style="text-align:center;color:#303133;">操作说明</th></tr>'
    + '<tr><td>第一次预紧</td>'
    + '<td style="text-align:center;color:#409eff;">40 Nm</td>'
    + '<td style="text-align:center;">按对角线顺序</td></tr>'
    + '<tr style="background-color:#fafafa;"><td>第二次紧固</td>'
    + '<td style="text-align:center;color:#e6a23c;">80 Nm</td>'
    + '<td style="text-align:center;">按对角线顺序</td></tr>'
    + '<tr><td style="font-weight:bold;">最终紧固</td>'
    + '<td style="text-align:center;color:#f56c6c;font-weight:bold;">120 Nm</td>'
    + '<td style="text-align:center;color:#f56c6c;">按对角线顺序，需复验</td></tr></table>'
    + '<p style="margin-top:8px;"><span style="color:#f56c6c;">⚠ 注意：</span>'
    + '缸盖密封面<span style="text-decoration:underline;color:#f56c6c;">严禁</span>使用金属刮刀清理，'
    + '<span style="color:#909399;">应使用专用塑料刮板。</span></p>'
    + '</div>';

  // 工序3: 附件安装 — 富文本包含检验清单
  proc.children[2].description_html = '<div style="font-family:sans-serif;font-size:14px;line-height:1.6;">'
    + '<h3 style="color:#1a1a2e;border-bottom:2px solid #e6a23c;padding-bottom:6px;">附件安装工序说明</h3>'
    + '<p>附件安装工序负责<span style="color:#409eff;text-decoration:underline;">进排气系统</span>、'
    + '<span style="color:#409eff;text-decoration:underline;">线束连接</span>等外围部件的安装，'
    + '是发动机总装的<span style="color:#e6a23c;font-weight:bold;">最后阶段</span>。</p>'
    + '<p style="margin:8px 0;"><img src="' + processIcon + '" width="40" style="vertical-align:middle;" />'
    + ' <span style="color:#909399;font-size:12px;">工艺标识</span></p>'
    + '<h4 style="color:#303133;">关键检验项目</h4>'
    + '<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;border-color:#dcdfe6;width:100%;font-size:13px;">'
    + '<tr style="background-color:#f0f2f5;">'
    + '<th style="text-align:left;color:#303133;">检验项</th>'
    + '<th style="text-align:center;color:#303133;">标准值</th>'
    + '<th style="text-align:center;color:#303133;">检验方法</th></tr>'
    + '<tr><td>进气歧管真空度</td>'
    + '<td style="text-align:center;">≥ -60 kPa</td>'
    + '<td style="text-align:center;">真空表检测</td></tr>'
    + '<tr style="background-color:#fafafa;"><td>排气歧管密封性</td>'
    + '<td style="text-align:center;color:#67c23a;font-weight:bold;">零泄漏</td>'
    + '<td style="text-align:center;">烟雾检测法</td></tr>'
    + '<tr><td>线束绝缘电阻</td>'
    + '<td style="text-align:center;">≥ 10 MΩ</td>'
    + '<td style="text-align:center;">兆欧表</td></tr>'
    + '<tr style="background-color:#fafafa;"><td>接头拉拔力</td>'
    + '<td style="text-align:center;">≥ 50 N</td>'
    + '<td style="text-align:center;">拉力计</td></tr></table>'
    + '<p style="margin-top:8px;"><span style="color:#f56c6c;font-weight:bold;">⚠ 安全警告：</span>'
    + '排气歧管可能有<span style="text-decoration:underline;color:#f56c6c;">锐利边缘</span>，'
    + '操作时请佩戴<span style="color:#409eff;font-weight:bold;">防割手套</span>。</p>'
    + '</div>';

  zip.file(procKey, JSON.stringify(proc, null, 2));

  const compKey = Object.keys(zip.files).find(k => k.includes('components.json'));
  const compTxt = await zip.file(compKey).async('string');
  const comps = JSON.parse(compTxt);
  
  const targetTableIds = ['comp_proc_list', 'comp_procedure_list'];
  let updated = false;

  targetTableIds.forEach(targetId => {
    const listObj = comps.find(c => c.id === targetId);
    if (listObj) {
      updated = true;
      // 设置现有列宽：代码 -> 180, 名称 -> 350, 时长(min) -> 200
      listObj.config.columns.forEach(col => {
        if (col.prop === 'code') col.width = 180;
        if (col.prop === 'name') col.width = 350;
        if (col.prop === 'duration') col.width = 200;
      });

      const hasRichCol = listObj.config.columns.some(c => c.isRichText === true);
      if (!hasRichCol) {
        listObj.config.columns.push({
          label: '内容',
          prop: 'description_html',
          width: -1, // -1表示自适应剩余空白（Flex），或者设为 300
          isRichText: true
        });
      } else {
        // 已经存在富文本列的话更新一下宽度
        const richCol = listObj.config.columns.find(c => c.isRichText === true);
        if (richCol) richCol.width = -1;
      }
    }
  });

  if (updated) {
    zip.file(compKey, JSON.stringify(comps, null, 2));
  }

  const newBuf = await zip.generateAsync({ type: 'nodebuffer' });
  fs.writeFileSync('static/data_package_v7_richtext.srd', newBuf);
  console.log('Done! Generated static/data_package_v7_richtext.srd');
})().catch(console.error);
