"""
消融实验结果可视化
生成论文用双轴对比图：精准R@5（左轴）+ 安全拦截率（右轴）
"""

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np

# ===== 字体设置（支持中文）=====
plt.rcParams['font.sans-serif'] = ['SimHei', 'Microsoft YaHei', 'DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False

# ===== 实验数据（来自真实运行结果）=====
configs = [
    'Baseline\n(无创新)',
    '+CAS\n(口语路由)',
    '+CAS+H2R\n(层次检索)',
    'Full\n(CAS+H2R+JCS)'
]

# 精准 R@5（仅放行查询中的命中率）
precision_r5 = [97.0, 97.0, 74.0, 83.1]

# 全量 R@5（含拦截）
total_r5 = [97.0, 97.0, 74.0, 59.0]

# JCS 安全拦截率
intercept_rate = [0.0, 0.0, 0.0, 96.0]

# 延迟 ms
latency = [12.64, 12.54, 12.33, 12.66]

x = np.arange(len(configs))
width = 0.32

# ===== 创建图形 =====
fig, ax1 = plt.subplots(figsize=(10, 6))
ax2 = ax1.twinx()

# 左轴：召回率柱状图
bars1 = ax1.bar(x - width/2, precision_r5, width,
                label='精准 Recall@5（放行查询）',
                color='#2196F3', alpha=0.85, zorder=3)
bars2 = ax1.bar(x + width/2, total_r5, width,
                label='全量 Recall@5（含拦截）',
                color='#90CAF9', alpha=0.85, zorder=3)

# 右轴：拦截率折线图
line = ax2.plot(x, intercept_rate,
                color='#F44336', marker='D', markersize=8,
                linewidth=2.5, linestyle='--',
                label='安全拦截率（JCS）', zorder=4)

# 数值标注（精准R@5）
for bar, val in zip(bars1, precision_r5):
    ax1.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.8,
             f'{val:.1f}%', ha='center', va='bottom', fontsize=9.5,
             fontweight='bold', color='#1565C0')

# 数值标注（全量R@5）
for bar, val in zip(bars2, total_r5):
    ax1.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.8,
             f'{val:.1f}%', ha='center', va='bottom', fontsize=8.5,
             color='#546E7A')

# 拦截率标注
for xi, val in zip(x, intercept_rate):
    if val > 0:
        ax2.text(xi + 0.05, val + 1.5, f'{val:.0f}%',
                 ha='left', va='bottom', fontsize=10,
                 fontweight='bold', color='#C62828')

# ===== 特别标注 Full 系统的"答则必准"特性 =====
ax1.annotate('答则必准\nPrec-R@5=83.1%', 
             xy=(3 - width/2, 83.1), xytext=(2.1, 88),
             fontsize=8.5, color='#1565C0',
             arrowprops=dict(arrowstyle='->', color='#1565C0', lw=1.5))

# ===== 坐标轴美化 =====
ax1.set_xlabel('系统配置', fontsize=12, labelpad=8)
ax1.set_ylabel('Recall@5 (%)', fontsize=12, color='#1565C0')
ax2.set_ylabel('安全拦截率 (%)', fontsize=12, color='#F44336')

ax1.set_ylim(0, 115)
ax2.set_ylim(0, 115)
ax1.set_xticks(x)
ax1.set_xticklabels(configs, fontsize=10)
ax1.tick_params(axis='y', labelcolor='#1565C0')
ax2.tick_params(axis='y', labelcolor='#F44336')

ax1.yaxis.grid(True, alpha=0.4, linestyle='--', zorder=0)
ax1.set_axisbelow(True)

# ===== 图例合并 =====
handles = [
    mpatches.Patch(color='#2196F3', alpha=0.85, label='精准 Recall@5（放行查询）'),
    mpatches.Patch(color='#90CAF9', alpha=0.85, label='全量 Recall@5（含拦截）'),
    plt.Line2D([0], [0], color='#F44336', marker='D', markersize=8,
               linewidth=2.5, linestyle='--', label='JCS 安全拦截率')
]
ax1.legend(handles=handles, loc='upper left', fontsize=9.5,
           framealpha=0.9, edgecolor='#BDBDBD')

plt.title('消融实验结果：各模块对召回率与安全拦截率的贡献',
          fontsize=13, fontweight='bold', pad=15)

plt.tight_layout()
plt.savefig('ablation_results.png', dpi=300, bbox_inches='tight',
            facecolor='white')
plt.savefig('ablation_results.pdf', bbox_inches='tight',
            facecolor='white')
print("✅ 图片已保存: ablation_results.png (300dpi) + ablation_results.pdf")
plt.show()
