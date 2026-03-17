const fs = require('fs');
const JSZip = require('jszip');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

/**
 * 生成一个真实的测试PDF文件
 * 内容：V8发动机缸体组装指导手册
 */
async function generateTestPdf() {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // 第1页：封面
  const page1 = pdfDoc.addPage([595.28, 841.89]); // A4
  page1.drawText('V8 Engine Assembly', {
    x: 120, y: 700, size: 32, font: boldFont, color: rgb(0.03, 0.57, 0.7)
  });
  page1.drawText('Cylinder Block Assembly Guide', {
    x: 130, y: 660, size: 20, font: font, color: rgb(0.2, 0.2, 0.2)
  });
  page1.drawText('Document No: MPM-V8-001', {
    x: 180, y: 600, size: 14, font: font, color: rgb(0.5, 0.5, 0.5)
  });
  page1.drawText('Version: 2.0  |  2026-03-17', {
    x: 180, y: 575, size: 14, font: font, color: rgb(0.5, 0.5, 0.5)
  });
  page1.drawText('CONFIDENTIAL', {
    x: 220, y: 100, size: 16, font: boldFont, color: rgb(0.9, 0.3, 0.3)
  });

  // 第2页：扭矩参数表
  const page2 = pdfDoc.addPage([595.28, 841.89]);
  page2.drawText('Torque Specifications', {
    x: 50, y: 780, size: 24, font: boldFont, color: rgb(0.03, 0.57, 0.7)
  });

  const tableData = [
    ['Component', 'Torque (Nm)', 'Grade'],
    ['Main Bearing Cap Bolt', '65 +/- 3', 'A'],
    ['Connecting Rod Bolt', '45 +/- 2', 'A'],
    ['Flywheel Bolt', '90 +/- 5', 'B'],
    ['Oil Pan Bolt', '25 +/- 2', 'C'],
    ['Timing Cover Bolt', '15 +/- 1', 'C'],
    ['Cylinder Head Bolt (Stage 1)', '40', 'A'],
    ['Cylinder Head Bolt (Stage 2)', '80', 'A'],
    ['Cylinder Head Bolt (Final)', '120', 'A'],
  ];

  let yPos = 740;
  tableData.forEach((row, idx) => {
    const isHeader = idx === 0;
    const rowFont = isHeader ? boldFont : font;
    const rowColor = isHeader ? rgb(0.1, 0.1, 0.1) : rgb(0.3, 0.3, 0.3);
    page2.drawText(row[0], { x: 50, y: yPos, size: 12, font: rowFont, color: rowColor });
    page2.drawText(row[1], { x: 300, y: yPos, size: 12, font: rowFont, color: rowColor });
    page2.drawText(row[2], { x: 450, y: yPos, size: 12, font: rowFont, color: rowColor });
    yPos -= 28;
  });

  page2.drawText('Note: All torque values must be verified with calibrated torque wrench.', {
    x: 50, y: yPos - 30, size: 11, font: font, color: rgb(0.9, 0.3, 0.3)
  });

  // 第3页：操作步骤
  const page3 = pdfDoc.addPage([595.28, 841.89]);
  page3.drawText('Assembly Procedure', {
    x: 50, y: 780, size: 24, font: boldFont, color: rgb(0.03, 0.57, 0.7)
  });

  const steps = [
    'Step 1: Clean all mating surfaces thoroughly',
    'Step 2: Apply assembly lubricant to bearing surfaces',
    'Step 3: Install main bearing shells (check oil holes alignment)',
    'Step 4: Position crankshaft carefully into bearing saddles',
    'Step 5: Install main bearing caps (numbered sequence)',
    'Step 6: Torque main bearing cap bolts to specification',
    'Step 7: Check crankshaft end play (0.05-0.25mm)',
    'Step 8: Install piston/connecting rod assemblies',
    'Step 9: Torque connecting rod bolts to specification',
    'Step 10: Verify crankshaft rotates freely by hand',
  ];

  yPos = 740;
  steps.forEach(step => {
    page3.drawText(step, { x: 50, y: yPos, size: 12, font: font, color: rgb(0.2, 0.2, 0.2) });
    yPos -= 30;
  });

  page3.drawText('End of Document', {
    x: 230, y: 80, size: 14, font: boldFont, color: rgb(0.5, 0.5, 0.5)
  });

  return await pdfDoc.save();
}

(async () => {
  // 1. 读取 v7 richtext 包
  const buf = fs.readFileSync('static/data_package_v7_richtext.srd');
  const zip = await JSZip.loadAsync(buf);

  console.log('ZIP files:', Object.keys(zip.files));

  // 2. 生成测试PDF
  console.log('Generating test PDF...');
  const pdfBytes = await generateTestPdf();
  console.log('PDF generated, size:', pdfBytes.length, 'bytes');

  // 3. 将PDF放入 assets/documents/ 目录
  zip.file('assets/documents/v8_assembly_guide.pdf', pdfBytes);

  // 4. 读取工艺数据，添加PDF资源引用
  const procKey = Object.keys(zip.files).find(k => k.includes('proc_v8_engine'));
  if (!procKey) {
    console.error('proc_v8_engine not found!');
    process.exit(1);
  }
  const procTxt = await zip.file(procKey).async('string');
  const proc = JSON.parse(procTxt);

  // 在工艺根节点添加 resources（PDF 附件）
  if (!proc.resources) {
    proc.resources = [];
  }
  proc.resources.push({
    id: 'res_pdf_v8_assembly',
    type: 'document',
    name: 'V8引擎缸体组装指导手册.pdf',
    path: 'assets/documents/v8_assembly_guide.pdf',
    description: 'V8发动机缸体组装完整操作手册，含扭矩参数表和装配步骤。'
  });

  // 在第一个工序（缸体组装）也添加 PDF 引用
  if (proc.children && proc.children.length > 0) {
    const firstChild = proc.children[0];
    if (!firstChild.resources) {
      firstChild.resources = [];
    }
    firstChild.resources.push({
      id: 'res_pdf_cylinder_block',
      type: 'document',
      name: '缸体组装扭矩参数.pdf',
      path: 'assets/documents/v8_assembly_guide.pdf',
      description: '缸体组装关键扭矩参数速查表'
    });
  }

  // 保存修改后的工艺数据
  zip.file(procKey, JSON.stringify(proc, null, 2));

  // 5. 生成新包
  const newBuf = await zip.generateAsync({ type: 'nodebuffer' });
  fs.writeFileSync('static/data_package_v8_pdf.srd', newBuf);
  console.log('Done! Generated static/data_package_v8_pdf.srd');
  console.log('PDF resources added to process root and first child node.');
})().catch(console.error);
