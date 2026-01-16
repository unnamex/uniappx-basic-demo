<template>
	<view :class="outsiderLayout.container">
		<view v-if="$slots['header']" :class="outsiderLayout.hf">
			<slot name="header"></slot>
		</view>
		<view style="flex:auto;overflow: hidden;">
			<view :class="outsiderLayout.bodyContainer">
				<view v-if="$slots['left']" :class="outsiderLayout.lr" :style="{'flex-basis':$attrs['left-width']||'auto'}">
					<slot name="left"></slot>
				</view>
				<scroll-view scroll-y :class="outsiderLayout.body">
					<slot></slot>
				</scroll-view>
				<view v-if="$slots['right']" :class="outsiderLayout.lr" :style="{'flex-basis':$attrs['right-width']||'auto'}">
					<slot name="right"></slot>
				</view>
			</view>
		</view>
		<view v-if="$slots['footer']" :class="outsiderLayout.hf">
			<slot name="footer"></slot>
		</view>
	</view>
</template>
<style module="outsiderLayout">
	.container{
		display: -webkit-flex; /* Safari */
		display: flex;
		flex-direction: column;
		height:100%;
	}
	.bodyContainer{
		display: -webkit-flex; /* Safari */
		display: flex;
		height: 100%;
		flex-direction: row;
	}
	.body{
		display:inline-block;
		flex: auto;
	}
	.hf{
		overflow: hidden;
		flex: none;
	}
	.lr{
		display:inline-block;
		overflow:hidden;
		flex: none;
	}
</style>