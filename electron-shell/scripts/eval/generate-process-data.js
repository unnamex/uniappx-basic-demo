/**
 * 生成逼真的工艺数据并构建向量索引
 * 
 * 绕过 Electron 依赖，直接调用 vectorizer 的核心函数
 * 生成 6 个真实工艺场景的数据，覆盖机加工、装配、热处理、焊接、检测、表面处理
 */

// ===== 模拟 Electron app 对象，避免 require('electron') 崩溃 =====
const Module = require('module')
const originalResolve = Module._resolveFilename
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === 'electron') {
    // 返回一个假的 electron 模块
    return require.resolve('./mock-electron.js')
  }
  return originalResolve.call(this, request, parent, isMain, options)
}

const fs = require('fs')
const path = require('path')

// 先创建 mock-electron 模块
const mockElectronPath = path.join(__dirname, 'mock-electron.js')
fs.writeFileSync(mockElectronPath, `
module.exports = {
  app: {
    isPackaged: false,
    getPath: (name) => require('path').join(__dirname, '..', '..'),
    getAppPath: () => require('path').join(__dirname, '..', '..')
  }
}
`)

const { buildChunks, buildIndex } = require('../../ai-service/rag/vectorizer')

// ===== 6 个逼真的工艺数据集 =====
const processDataSets = [
  // 工艺1: TC4钛合金叶片五轴铣削
  {
    processes: [{
      name: 'TC4钛合金压气机叶片五轴铣削工艺',
      code: 'PROC-TC4-BLADE-001',
      classId_display: '机加工艺',
      version: '2.1.0',
      stateName: '已发布',
      partName: 'TC4钛合金三级压气机叶片',
      partCode: 'PART-BLADE-TC4-003',
      departmentName: '精密加工车间',
      creator: '李工',
      createTime: '2025-11-15 09:30:00',
      modifier: '王工',
      modifyTime: '2026-01-20 14:15:00',
      note: 'TC4钛合金导热性差，切削速度不宜超过60m/min',
      routeContent: '毛坯检验→粗铣型面→半精铣→精铣叶身→抛光→终检'
    }],
    operations: [
      {
        serialNumber: 1, name: '毛坯来料检验', code: 'OP-TC4-01',
        isKey: true,
        content: '检验TC4钛合金锻件毛坯尺寸及材质证明。使用光谱仪验证材料成分：Al含量5.5-6.75%，V含量3.5-4.5%。检查锻造流线方向是否符合图纸要求。毛坯表面不得有裂纹、折叠等缺陷，使用荧光渗透检测（FPI）进行表面探伤。不合格品标记隔离并填写NCR报告。'
      },
      {
        serialNumber: 2, name: '粗铣叶身型面', code: 'OP-TC4-02',
        isKey: true,
        content: '使用五轴联动加工中心（DMG MORI DMU 80P），刀具选用φ10硬质合金球头铣刀（TiAlN涂层）。切削参数：主轴转速n=3000rpm，进给速度f=800mm/min，切削深度ap=1.5mm，切削宽度ae=5mm。必须开启高压内冷（冷却液压力≥20bar），防止TC4钛合金因导热性差导致刀具过热烧刀。粗铣后留量0.5mm。'
      },
      {
        serialNumber: 3, name: '半精铣叶身', code: 'OP-TC4-03',
        content: '换用φ6球头铣刀。切削参数调整：n=4000rpm，f=600mm/min，ap=0.3mm，ae=2mm。走刀策略采用等残留高度铣削，保证型面过渡光顺。刀具磨损量监控：后刀面磨损VB≤0.15mm时必须换刀，防止表面质量恶化。半精铣后留量0.15mm。'
      },
      {
        serialNumber: 4, name: '精铣叶身型面', code: 'OP-TC4-04',
        isKey: true,
        content: '使用φ4球头铣刀（金刚石涂层）。切削参数：n=6000rpm，f=400mm/min，ap=0.1mm。叶身型面轮廓度公差±0.05mm，表面粗糙度Ra≤1.6μm。加工完成后使用三坐标测量机（CMM）进行型面检测，采样点不少于200个。如发现超差，允许一次修磨返工。'
      },
      {
        serialNumber: 5, name: '叶片抛光', code: 'OP-TC4-05',
        content: '使用磨粒流抛光工艺（AFM），抛光介质选用SiC磨料（粒度#600），抛光压力15MPa，循环次数30次。抛光后表面粗糙度Ra≤0.8μm。抛光完成后进行目视检查，不得有划痕、烧伤、腐蚀等表面缺陷。'
      }
    ],
    steps: [
      {
        serialNumber: 1, name: '装夹定位', code: 'S-TC4-01',
        content: '使用叶片专用夹具，以叶根定位面和两侧基准孔定位。夹紧力控制在500N以内，防止薄壁叶片变形。装夹后用千分表检查叶片跳动量≤0.02mm。'
      },
      {
        serialNumber: 2, name: '刀具预检', code: 'S-TC4-02',
        content: '上机前必须使用对刀仪检查刀具径向跳动≤0.01mm。新刀具需进行试切验证，确认切削参数合理后方可正式加工。每把刀具加工寿命记录在工具管理卡上。'
      },
      {
        serialNumber: 3, name: '冷却液检查', code: 'S-TC4-03',
        content: '开机前检查冷却液浓度（折光仪读数8-12%），pH值7.5-9.0。TC4钛合金加工必须使用含氯极压添加剂的专用切削液，禁止使用普通乳化液。冷却液压力不低于20bar，流量不低于30L/min。'
      },
      {
        serialNumber: 4, name: '首件三坐标检测', code: 'S-TC4-04',
        content: '首件加工完成后送三坐标检测室，型面采样200点以上。检测报告中叶型轮廓度、前后缘圆角半径、叶身扭转角度需全部合格。首检通过后方可批量加工。'
      }
    ]
  },

  // 工艺2: 304不锈钢管路焊接
  {
    processes: [{
      name: '304不锈钢液压管路TIG焊接工艺',
      code: 'PROC-WELD-304-002',
      classId_display: '焊接工艺',
      version: '1.3.0',
      stateName: '已发布',
      partName: '304不锈钢高压液压管总成',
      partCode: 'PART-PIPE-304-012',
      departmentName: '焊接车间',
      creator: '陈工',
      createTime: '2025-08-10 10:00:00',
      note: '304不锈钢焊接需控制层间温度防止敏化',
      routeContent: '管口准备→预热→打底焊→填充焊→盖面焊→焊后热处理→无损检测'
    }],
    operations: [
      {
        serialNumber: 1, name: '焊前管口准备', code: 'OP-WELD-01',
        content: '管口切割后使用内径铰刀修整，坡口角度30°±2°，钝边1.0-1.5mm。清除管口内外壁氧化层和油污，使用丙酮擦拭坡口及两侧20mm范围。组对间隙1.5-2.5mm，错边量≤0.5mm。使用专用对口器固定。'
      },
      {
        serialNumber: 2, name: 'TIG打底焊', code: 'OP-WELD-02',
        isKey: true,
        content: '采用直流正接TIG焊，焊丝ER308L（φ2.0mm）。焊接参数：电流80-100A，电压10-12V，焊速80-120mm/min。钨极直径φ2.4mm，氩气流量前保护12-15L/min，背面保护8-10L/min。管内必须充氩保护，氧含量≤50ppm后方可引弧。层间温度≤150℃。'
      },
      {
        serialNumber: 3, name: '填充焊及盖面焊', code: 'OP-WELD-03',
        content: '填充层电流100-120A，采用月牙形摆动手法。每层焊前清理层间飞溅和氧化物。盖面层电流90-110A，焊缝余高0.5-2.0mm，宽度覆盖坡口两侧各1-2mm。焊缝外观应均匀美观，无咬边、气孔、未熔合等缺陷。'
      },
      {
        serialNumber: 4, name: '焊后固溶热处理', code: 'OP-WELD-04',
        isKey: true,
        content: '焊接完成后24小时内进行固溶处理。加热温度1050±20℃，保温时间按壁厚计算（每mm保温3min，最短不低于30min）。出炉后水冷至室温。目的：消除焊接热影响区的晶间腐蚀敏化倾向，恢复耐蚀性。'
      },
      {
        serialNumber: 5, name: '无损检测', code: 'OP-WELD-05',
        isKey: true,
        content: '焊缝100%射线检测（RT），验收标准按NB/T 47013-2015 II级。同时进行液体渗透检测（PT），不得有线性显示。检测合格后在焊缝旁打检验钢印。不合格焊缝允许返修一次，返修后重新检测。'
      }
    ],
    steps: [
      {
        serialNumber: 1, name: '管内充氩操作', code: 'S-WELD-01',
        content: '用水溶性纸封堵管口两端（留焊口），从一端通入氩气（纯度≥99.99%），使用测氧仪检测另一端排气口氧含量。当氧含量≤50ppm时方可施焊。焊接过程中持续通氩保护，焊完后继续保护至焊缝温度降至200℃以下。'
      },
      {
        serialNumber: 2, name: '焊工资质确认', code: 'S-WELD-02',
        content: '施焊前确认焊工持有效ASME IX资质证书，且在有效期内。焊工应在相同材质、相同管径和壁厚范围内取得合格资质。首次施焊新材料或新规格时，需先完成焊接工艺评定（WPQ）。'
      }
    ]
  },

  // 工艺3: 铝合金壳体数控车削
  {
    processes: [{
      name: '7075铝合金电子设备壳体数控车削工艺',
      code: 'PROC-CNC-7075-003',
      classId_display: '机加工艺',
      version: '1.0.0',
      stateName: '已发布',
      partName: '7075-T6铝合金雷达壳体',
      partCode: 'PART-SHELL-7075-008',
      departmentName: '数控加工车间',
      creator: '刘工',
      createTime: '2026-02-18 08:45:00',
      note: '铝合金加工注意排屑和表面光洁度',
      routeContent: '毛坯检验→粗车外圆→粗车内孔→半精车→精车→去毛刺→阳极氧化→终检'
    }],
    operations: [
      {
        serialNumber: 1, name: '粗车外圆及端面', code: 'OP-CNC-01',
        content: '使用数控车床（MAZAK QT-250），三爪卡盘装夹。刀具：CNMG120408硬质合金刀片。切削参数：n=2000rpm，f=0.25mm/r，ap=3mm。粗车至外圆留量0.5mm，端面留量0.3mm。加工过程需开启切削液冲洗，防止铝屑缠绕刀具。'
      },
      {
        serialNumber: 2, name: '粗车内孔', code: 'OP-CNC-02',
        content: '使用内孔车刀（最小加工直径φ40mm），切削参数：n=1500rpm，f=0.15mm/r，ap=2mm。注意内孔排屑困难，建议采用啄式进刀（每进5mm退刀一次断屑）。内孔留量0.4mm。深径比超过3倍时需使用减振刀杆。'
      },
      {
        serialNumber: 3, name: '精车外圆及内孔', code: 'OP-CNC-03',
        isKey: true,
        content: '换用DCGT070204金刚石刀片（PCD刀具）。外圆精车：n=3000rpm，f=0.08mm/r，ap=0.15mm。内孔精车：n=2500rpm，f=0.06mm/r，ap=0.1mm。尺寸公差：外圆φ120 0/-0.025mm，内孔φ80 +0.02/0mm。表面粗糙度Ra≤0.8μm。每加工5件进行抽检。'
      },
      {
        serialNumber: 4, name: '阳极氧化处理', code: 'OP-CNC-04',
        content: '硫酸阳极氧化（H2SO4浓度15-20%，温度18-22℃），氧化电压14-18V，时间30-45min。氧化膜厚度8-15μm。氧化后封孔处理（沸水封孔或重铬酸盐封孔）。成品外观应均匀一致，无色差、无花斑、无划伤。'
      }
    ],
    steps: [
      {
        serialNumber: 1, name: '三爪卡盘校正', code: 'S-CNC-01',
        content: '每次装夹后用百分表校正工件跳动，外圆跳动≤0.03mm，端面跳动≤0.02mm。卡盘爪面必须清洁无铝屑残留。如使用软爪，需在装夹工件前车修软爪内径至与工件外径配合。'
      },
      {
        serialNumber: 2, name: '首件全检', code: 'S-CNC-02',
        content: '首件加工完成后，使用内径千分尺、外径千分尺和粗糙度仪进行全尺寸检测。所有关键尺寸必须在公差范围内。检测合格后由质检员在工序流转卡上签字确认，方可继续批量加工。'
      }
    ]
  },

  // 工艺4: 齿轮热处理
  {
    processes: [{
      name: '20CrMnTi齿轮渗碳淬火热处理工艺',
      code: 'PROC-HT-GEAR-004',
      classId_display: '热处理工艺',
      version: '3.2.0',
      stateName: '已发布',
      partName: '20CrMnTi变速箱主动齿轮',
      partCode: 'PART-GEAR-20CR-015',
      departmentName: '热处理车间',
      creator: '赵工',
      createTime: '2025-06-22 13:00:00',
      note: '渗碳温度和碳势控制是关键，直接影响齿面硬度和芯部韧性',
      routeContent: '清洗→装炉→渗碳→扩散→淬火→低温回火→喷丸→硬度检测'
    }],
    operations: [
      {
        serialNumber: 1, name: '零件清洗及装炉', code: 'OP-HT-01',
        content: '用超声波清洗机清洗齿轮（清洗液温度60-70℃），去除加工残留的切削液和油污。清洗后烘干。非渗碳表面（如轴孔、端面）涂覆防渗碳涂料。装炉时齿轮间距≥10mm，保证气氛循环均匀。装炉量不超过炉膛容积的60%。'
      },
      {
        serialNumber: 2, name: '渗碳阶段', code: 'OP-HT-02',
        isKey: true,
        content: '使用密封箱式多用炉。升温至920±10℃，强渗碳势CP=1.05-1.15%，保温时间根据渗层深度要求计算（一般0.8-1.2mm渗层需强渗4-6小时）。扩散碳势CP=0.75-0.85%，保温2-3小时。全程通入甲醇+丙烷混合气氛，氧探头实时监控碳势。碳势偏差超过±0.05%时必须立即调整。'
      },
      {
        serialNumber: 3, name: '淬火', code: 'OP-HT-03',
        isKey: true,
        content: '渗碳结束后炉温降至830±10℃（奥氏体化温度），保温30-45分钟使碳浓度均匀化。出炉后直接入油淬火（淬火油温60-80℃，快速光亮淬火油KR118）。入油后搅拌3-5分钟。油中冷却至油温+30℃后取出空冷。淬火转移时间≤15秒。'
      },
      {
        serialNumber: 4, name: '低温回火', code: 'OP-HT-04',
        content: '淬火后4小时内进行低温回火。回火温度180±10℃，保温时间2-3小时。空冷至室温。低温回火的目的是消除淬火内应力，稳定组织，同时不降低表面硬度。回火后齿面硬度HRC58-62，芯部硬度HRC33-38。'
      },
      {
        serialNumber: 5, name: '抛丸强化及检验', code: 'OP-HT-05',
        content: '使用φ0.6mm铸钢丸，喷丸强度Almen A片弧高值0.35-0.50mmA，覆盖率≥200%。喷丸后检测：表面硬度HRC58-62（维氏硬度计），有效渗碳层深度0.8-1.2mm（金相法），芯部组织为低碳马氏体+少量残余奥氏体。'
      }
    ],
    steps: [
      {
        serialNumber: 1, name: '碳势校准', code: 'S-HT-01',
        content: '每炉开炉前用标准碳势片（含碳量已知的钢片）校准氧探头。将碳势片放入炉膛，保温30分钟后取出称重，计算增碳量验证氧探头读数准确性。偏差超过0.03%时必须更换或重新标定氧探头。'
      },
      {
        serialNumber: 2, name: '淬火油温监控', code: 'S-HT-02',
        content: '淬火前确认油温在60-80℃范围内。油温过低会导致淬裂，过高会导致硬度不足。淬火过程中持续搅拌冷却，监控油温升幅不超过20℃。淬火油每月取样送检（粘度、闪点、含水量），含水量>0.05%时必须脱水处理。'
      },
      {
        serialNumber: 3, name: '金相抽检', code: 'S-HT-03',
        content: '每炉随机抽取1-2件进行金相检验。切取齿面截面，观察渗碳层碳化物级别（≤3级）、马氏体级别（1-4级）、残余奥氏体含量（≤25%）、心部铁素体含量（≤5级）。检验结果记录在热处理质量记录表中。'
      }
    ]
  },

  // 工艺5: 精密装配
  {
    processes: [{
      name: '精密减速机总装工艺',
      code: 'PROC-ASM-REDUCER-005',
      classId_display: '装配工艺',
      version: '2.0.0',
      stateName: '已发布',
      partName: 'RV-320精密摆线针轮减速机',
      partCode: 'PART-REDUCER-RV320-001',
      departmentName: '精密装配车间',
      creator: '孙工',
      createTime: '2026-01-05 09:00:00',
      note: '减速机装配精度直接影响回差和传动效率',
      routeContent: '零件清洗→轴承压装→齿轮副装配→箱体合装→注油密封→空载跑合→精度检测'
    }],
    operations: [
      {
        serialNumber: 1, name: '零件清洗及配对', code: 'OP-ASM-01',
        content: '所有零件用汽油清洗后用压缩空气吹干。轴承、齿轮等精密零件不得直接用手触摸，必须戴棉手套。摆线轮与针齿壳进行配对标记，记录实测间隙值。输入轴与偏心轴承的配合间隙0.005-0.015mm。'
      },
      {
        serialNumber: 2, name: '偏心轴承及摆线轮安装', code: 'OP-ASM-02',
        isKey: true,
        content: '将偏心轴承加热至80-100℃（油浴加热），热装到输入轴上。轴承轴向定位后用挡圈固定。两片摆线轮错位180°安装，注意标记方向。安装后手动转动输入轴检查转动灵活性，不得有卡滞现象。轴向窜动量≤0.03mm。'
      },
      {
        serialNumber: 3, name: '针齿壳及输出法兰装配', code: 'OP-ASM-03',
        isKey: true,
        content: '针齿销涂抹润滑脂后装入针齿壳孔中（共40根）。检查每根针齿销的转动灵活性。将摆线轮组件装入针齿壳，检查啮合状态。安装输出法兰，柱销孔与摆线轮柱销对齐。法兰螺栓按对角顺序分三次拧紧，最终力矩65±5N·m。'
      },
      {
        serialNumber: 4, name: '箱体密封及注油', code: 'OP-ASM-04',
        content: '箱体结合面涂抹三键1215液态密封胶（厚度≤0.1mm），合箱后按对角顺序拧紧螺栓，力矩45±3N·m。安装油封（骨架油封，唇口朝内）。从注油孔加注VG220号工业齿轮油，油量至油标中线。装好透气帽和油堵。'
      },
      {
        serialNumber: 5, name: '空载跑合试验', code: 'OP-ASM-05',
        isKey: true,
        content: '装配完成后进行空载跑合试验（正反转各2小时，输入转速1500rpm）。跑合期间监测：轴承温升≤35℃，噪声≤68dB(A)，无异常振动。跑合结束后放油检查油中无金属碎屑。更换新油后进行精度检测：回差≤1arcmin，传动效率≥85%。'
      }
    ],
    steps: [
      {
        serialNumber: 1, name: '力矩扳手校准', code: 'S-ASM-01',
        content: '装配前使用力矩校准仪检查力矩扳手精度，偏差≤±3%。每把力矩扳手标注校准日期和有效期（有效期6个月）。超期未校准的力矩扳手严禁使用。'
      },
      {
        serialNumber: 2, name: '轴承预紧调整', code: 'S-ASM-02',
        content: '输出轴承采用面对面（DB）安装方式，通过调整垫片厚度控制轴承预紧力。预紧量通过测量轴承启动力矩确定：启动力矩0.5-1.0N·m为合格。预紧力过大会导致轴承发热，过小会产生轴向间隙影响精度。'
      }
    ]
  },

  // 工艺6: 电气检测
  {
    processes: [{
      name: '伺服驱动器整机电气检测工艺',
      code: 'PROC-TEST-SERVO-006',
      classId_display: '检测工艺',
      version: '1.5.0',
      stateName: '已发布',
      partName: 'SV-2000伺服驱动器',
      partCode: 'PART-SERVO-2000-020',
      departmentName: '电气检测车间',
      creator: '周工',
      createTime: '2026-03-10 11:00:00',
      note: '高压测试区域必须设置安全围栏，操作人员必须持证上岗',
      routeContent: '外观检查→绝缘电阻测试→耐压测试→功能测试→老化试验→出厂检验'
    }],
    operations: [
      {
        serialNumber: 1, name: '外观及装配检查', code: 'OP-TEST-01',
        content: '检查驱动器外壳无划伤、变形。所有螺钉紧固力矩符合要求（M3螺钉0.5N·m，M4螺钉1.2N·m）。接线端子标识清晰完整。散热器安装牢固，导热硅脂涂覆均匀。PCB板目视检查：无虚焊、桥接、漏件。'
      },
      {
        serialNumber: 2, name: '绝缘电阻测试', code: 'OP-TEST-02',
        isKey: true,
        content: '使用500V兆欧表测试以下回路绝缘电阻：主回路对地、控制回路对地、主回路对控制回路。绝缘电阻≥100MΩ为合格。测试前确保被测回路已断电5分钟以上。环境湿度>80%时暂停测试。'
      },
      {
        serialNumber: 3, name: '耐压测试', code: 'OP-TEST-03',
        isKey: true,
        content: '使用耐压测试仪，主回路对地施加AC 1800V/1min，漏电流≤10mA。控制回路对地施加AC 500V/1min，漏电流≤5mA。注意：测试前必须确认安全围栏已关闭，警示灯亮起。严禁在耐压测试过程中触碰被测设备。测试结束后先放电再拆线。'
      },
      {
        serialNumber: 4, name: '功能及参数测试', code: 'OP-TEST-04',
        isKey: true,
        content: '连接额定负载电机，进行以下测试：1）空载运行：电机平稳旋转无异响。2）额定负载运行：输出电流偏差≤±3%，速度波动≤±0.1%。3）过载保护：施加120%额定负载，驱动器应在5秒内触发过载保护。4）通讯测试：RS485/EtherCAT通讯正常，丢包率≤0.01%。'
      },
      {
        serialNumber: 5, name: '72小时老化试验', code: 'OP-TEST-05',
        content: '将驱动器置于恒温箱内（温度45±2℃），连续满载运行72小时。每8小时记录一次输出电流、母线电压、IGBT结温、风扇转速等参数。老化结束后复测各项功能参数，前后偏差≤1%。老化期间任何参数异常或停机的产品判为不合格。'
      }
    ],
    steps: [
      {
        serialNumber: 1, name: '测试工装连接', code: 'S-TEST-01',
        content: '使用专用测试工装板连接驱动器。动力线使用4mm²硅胶线，控制线使用0.5mm²屏蔽线。接线完成后逐一确认端子接线正确性（对照接线图逐项核对）。接地线必须可靠连接（接地电阻≤0.1Ω）。'
      },
      {
        serialNumber: 2, name: '安全防护确认', code: 'S-TEST-02',
        content: '耐压测试前执行安全检查清单：1）安全围栏已关闭并锁定。2）警示灯/警示牌已启用。3）紧急停止按钮功能正常。4）操作人员已穿戴绝缘手套和绝缘鞋。5）测试区域无其他人员。以上5项全部确认后方可开始测试。'
      }
    ]
  }
]

async function main() {
  console.log('=== 开始生成逼真工艺数据并构建向量索引 ===\n')

  // 1. 将所有工艺数据转为 chunks
  let allChunks = []
  for (let i = 0; i < processDataSets.length; i++) {
    const data = processDataSets[i]
    const chunks = buildChunks(data)
    console.log(`[${i+1}/${processDataSets.length}] ${data.processes[0].name} → ${chunks.length} 个 chunks`)
    allChunks = allChunks.concat(chunks)
  }

  console.log(`\n总计生成 ${allChunks.length} 个 chunks，正在向量化...\n`)

  // 2. 调用 buildIndex 进行向量化和保存
  const startTime = Date.now()
  await buildIndex(allChunks, (current, total) => {
    if (current % 5 === 0 || current === total) {
      process.stdout.write(`\r[向量化] ${current}/${total} (${((current/total)*100).toFixed(1)}%)`)
    }
  })

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\n\n✅ 向量索引构建完成！耗时 ${elapsed} 秒`)
  console.log(`索引文件: ${path.join(__dirname, '../../ai-service/vector-index.json')}`)

  // 清理 mock 文件
  if (fs.existsSync(mockElectronPath)) fs.unlinkSync(mockElectronPath)
}

main().catch(err => {
  console.error('生成失败:', err)
  process.exit(1)
})
