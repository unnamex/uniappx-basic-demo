// 鸿蒙原生PDF查看组件 — 使用 defineNativeEmbed 嵌入到 uni-app x
// 遵循官方 embed 组件标准模式: https://uniapp.dcloud.net.cn/tutorial/harmony/native-component.html
import { pdfService, pdfViewManager, PdfView } from '@kit.PDFKit';
import { common } from '@kit.AbilityKit';
import { fileIo } from '@kit.CoreFileKit';
import { NativeEmbedBuilderOptions, NativeEmbedEvent, defineNativeEmbed } from '@dcloudio/uni-app-runtime';

// 扩展 Builder 选项，声明从 embed :options 传入的 src 属性
interface KuxPDFBuilderOptions extends NativeEmbedBuilderOptions {
	src: string;
}

// 事件回调的 detail 类型定义
interface PDFLoadEventDetail {
	success: boolean;
	message: string;
	pageCount: number;
}

interface PDFErrorEventDetail {
	code: number;
	message: string;
}

@Component
struct KuxPDFViewComponent {
	@Prop src: string = '';
	// 事件回调函数，由 Builder 从 options.on 中取出并传入
	onLoad?: Function;
	onError?: Function;

	private controller: pdfViewManager.PdfController = new pdfViewManager.PdfController();
	@State isReady: boolean = false;
	@State errorMsg: string = '';

	aboutToAppear() {
		console.log('[KuxPDFView] aboutToAppear, src=' + this.src);
		if (this.src !== '') {
			this.loadPdf(this.src);
		} else {
			console.warn('[KuxPDFView] src 为空，跳过加载');
			this.emitError(1, 'src 为空');
		}
	}

	/**
	 * 向前端发送加载成功事件
	 */
	private emitLoad(pageCount: number) {
		if (this.onLoad) {
			const detail: PDFLoadEventDetail = {
				success: true,
				message: 'PDF加载成功',
				pageCount: pageCount
			};
			this.onLoad({ detail } as NativeEmbedEvent);
		}
	}

	/**
	 * 向前端发送加载失败事件
	 */
	private emitError(code: number, message: string) {
		if (this.onError) {
			const detail: PDFErrorEventDetail = {
				code: code,
				message: message
			};
			this.onError({ detail } as NativeEmbedEvent);
		}
	}

	/**
	 * 加载PDF文件
	 * unifile:// 路径需要转换为系统沙箱绝对路径
	 */
	private async loadPdf(srcPath: string) {
		try {
			let filePath = srcPath;
			console.log('[KuxPDFView] loadPdf 开始, 原始路径=' + srcPath);

			// 将 unifile:// 路径转换为系统沙箱绝对路径
			if (filePath.startsWith('unifile://cache/')) {
				const context = getContext() as common.UIAbilityContext;
				const relativePath = filePath.replace('unifile://cache/', '');
				filePath = context.cacheDir + '/' + relativePath;
				console.log('[KuxPDFView] 转换缓存路径: ' + srcPath + ' -> ' + filePath);
			} else if (filePath.startsWith('unifile://usr/')) {
				const context = getContext() as common.UIAbilityContext;
				const relativePath = filePath.replace('unifile://usr/', '');
				filePath = context.filesDir + '/' + relativePath;
				console.log('[KuxPDFView] 转换用户路径: ' + srcPath + ' -> ' + filePath);
			} else if (filePath.startsWith('internal://app/')) {
				const context = getContext() as common.UIAbilityContext;
				const relativePath = filePath.replace('internal://app/', '');
				filePath = context.filesDir + '/' + relativePath;
				console.log('[KuxPDFView] 转换 internal app 路径: ' + srcPath + ' -> ' + filePath);
			} else if (filePath.startsWith('internal://cache/')) {
				const context = getContext() as common.UIAbilityContext;
				const relativePath = filePath.replace('internal://cache/', '');
				filePath = context.cacheDir + '/' + relativePath;
				console.log('[KuxPDFView] 转换 internal cache 路径: ' + srcPath + ' -> ' + filePath);
			}

			// 检查文件是否存在
			let fileExists = false;
			try {
				fileExists = fileIo.accessSync(filePath);
			} catch (e) {
				fileExists = false;
			}

			if (!fileExists) {
				console.error('[KuxPDFView] 文件不存在: ' + filePath);
				this.errorMsg = 'PDF文件不存在: ' + filePath;
				this.emitError(2, '文件不存在: ' + filePath);
				return;
			}

			console.log('[KuxPDFView] 文件存在，开始加载: ' + filePath);

			// 使用 controller.loadDocument 加载 PDF（异步）
			let loadResult: pdfService.ParseResult = await this.controller.loadDocument(filePath);
			console.log('[KuxPDFView] 加载结果: ' + loadResult);

			if (loadResult === pdfService.ParseResult.PARSE_SUCCESS) {
				this.isReady = true;
				console.log('[KuxPDFView] PDF加载成功，准备渲染');
				// 通过事件通知前端加载成功
				this.emitLoad(0);
			} else {
				this.errorMsg = 'PDF加载失败: ' + loadResult;
				console.error('[KuxPDFView] PDF加载失败, result=' + loadResult);
				this.emitError(3, 'PDF解析失败: ' + loadResult);
			}
		} catch (e) {
			console.error('[KuxPDFView] loadPdf 异常: ' + JSON.stringify(e));
			this.errorMsg = 'PDF加载异常: ' + JSON.stringify(e);
			this.emitError(4, 'PDF加载异常: ' + JSON.stringify(e));
		}
	}

	build() {
		Column() {
			if (this.isReady) {
				// PdfView 由 controller.loadDocument 驱动
				PdfView({
					controller: this.controller,
					pageFit: pdfService.PageFit.FIT_WIDTH,
					showScroll: true
				})
					.width('100%')
					.height('100%')
			} else if (this.errorMsg !== '') {
				Text(this.errorMsg)
					.fontSize(14)
					.fontColor('#EF4444')
					.textAlign(TextAlign.Center)
					.width('100%')
					.height('100%')
			} else {
				Text('正在加载 PDF...')
					.fontSize(14)
					.fontColor('#999999')
					.textAlign(TextAlign.Center)
					.width('100%')
					.height('100%')
			}
		}
		.width('100%')
		.height('100%')
	}
}

// 注册为 NativeEmbed 组件
// 遵循官方标准：通过 options.on 获取事件回调
@Builder
function KuxPDFBuilder(options: KuxPDFBuilderOptions) {
	KuxPDFViewComponent({
		src: options.src ?? '',
		onLoad: options?.on?.get('load'),
		onError: options?.on?.get('error')
	})
		.width(options.width)
		.height(options.height)
}

// 注册标签名为 'kux-pdf-native'，通过 embed 标签调用
defineNativeEmbed('kux-pdf-native', { builder: KuxPDFBuilder });

// 打印注册确认日志
console.log('[KuxPDFView] defineNativeEmbed 注册完成: kux-pdf-native');
