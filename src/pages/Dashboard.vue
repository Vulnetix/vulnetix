<script setup>
import { useAnalyticsStore } from '@/stores/analytics'
import AnalyticsFinanceTabs from '@/views/dashboard/AnalyticsFinanceTab.vue'
import AnalyticsOrderStatistics from '@/views/dashboard/AnalyticsOrderStatistics.vue'
import AnalyticsProfitReport from '@/views/dashboard/AnalyticsProfitReport.vue'
import AnalyticsTotalRevenue from '@/views/dashboard/AnalyticsTotalRevenue.vue'
import AnalyticsTransactions from '@/views/dashboard/AnalyticsTransactions.vue'
import AnalyticsWelcome from '@/views/dashboard/AnalyticsWelcome.vue'
// 👉 Images
import chart3 from '@images/cards/chart-error.png'
import chart1 from '@images/cards/chart-info.png'
import chart4 from '@images/cards/chart-purple.png'
import chart2 from '@images/cards/chart-success.png'

const Analytics = useAnalyticsStore()
const state = await Analytics.$state
</script>

<template>
  <VRow>
    <!-- 👉 Congratulations -->
    <VCol
      cols="12"
      md="8"
    >
      <AnalyticsWelcome />
    </VCol>

    <VCol
      cols="12"
      sm="4"
    >
      <VRow>
        <!-- 👉 Profit -->
        <VCol
          cols="12"
          md="6"
        >
          <CardStatisticsVertical v-bind="{
            title: 'Unresolved this week',
            image: chart1,
            stats: state.current_week.in_triage,
            change: state.current_week.unresolved_percentage,
            moreList: [
              {
                title: 'Go to Queue',
                value: 'queue'
              }
            ],
          }" />
        </VCol>

        <!-- 👉 Sales -->
        <VCol
          cols="12"
          md="6"
        >
          <CardStatisticsVertical v-bind="{
            title: 'Resolved this week',
            image: chart2,
            stats: state.current_week.resolved_all,
            change: state.current_week.resolved_percentage,
            moreList: [
              {
                title: 'Go to Queue',
                value: 'queue'
              }
            ],
          }" />
        </VCol>
      </VRow>
    </VCol>

    <!-- 👉 Total Revenue -->
    <VCol
      cols="12"
      md="8"
      order="2"
      order-md="1"
    >
      <AnalyticsTotalRevenue />
    </VCol>

    <VCol
      cols="12"
      sm="8"
      md="4"
      order="1"
      order-md="2"
    >
      <VRow>
        <!-- 👉 Payments -->
        <VCol
          cols="12"
          sm="6"
        >
          <CardStatisticsVertical v-bind="{
            title: 'Pix Automated',
            image: chart3,
            stats: state.total.triage_automated,
            change: state.total.automated_percentage,
            moreList: [
              {
                title: 'Go to Queue',
                value: 'queue'
              }
            ],
          }" />
        </VCol>

        <!-- 👉 Revenue -->
        <VCol
          cols="12"
          sm="6"
        >
          <CardStatisticsVertical v-bind="{
            title: 'Queued',
            image: chart4,
            stats: state.total.triage_unseen,
            change: -state.total.unseen_queue_percentage,
            moreList: [
              {
                title: 'Go to Queue',
                value: 'queue'
              }
            ],
          }" />
        </VCol>
      </VRow>

      <VRow>
        <!-- 👉 Profit Report -->
        <VCol
          cols="12"
          sm="12"
        >
          <AnalyticsProfitReport />
        </VCol>
      </VRow>
    </VCol>

    <!-- 👉 Order Statistics -->
    <VCol
      cols="12"
      md="4"
      sm="6"
      order="3"
    >
      <AnalyticsOrderStatistics />
    </VCol>

    <!-- 👉 Tabs chart -->
    <VCol
      cols="12"
      md="4"
      sm="6"
      order="3"
    >
      <AnalyticsFinanceTabs />
    </VCol>

    <!-- 👉 Transactions -->
    <VCol
      cols="12"
      md="4"
      sm="6"
      order="3"
    >
      <AnalyticsTransactions />
    </VCol>
  </VRow>
</template>
