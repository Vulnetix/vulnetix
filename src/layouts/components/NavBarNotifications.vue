<script setup>
import Notifications from '@core/components/Notifications.vue'

// Images
import avatar3 from '@images/icons/logo/linux.png'
import avatar4 from '@images/icons/logo/linux.png'
import avatar5 from '@images/icons/logo/linux.png'
import paypal from '@images/svg/paypal.svg'

const notifications = [
  {
    img: avatar4,
    title: 'Congratulation Flora! 🎉',
    subtitle: 'Won the monthly best seller badge',
    time: 'Today',
  },
  {
    text: 'Tom Holland',
    title: 'New user registered.',
    subtitle: '5 hours ago',
    time: 'Yesterday',
  },
  {
    img: avatar5,
    title: 'New message received 👋🏻',
    subtitle: 'You have 10 unread messages',
    time: '11 Aug',
  },
  {
    img: paypal,
    title: 'Paypal',
    subtitle: 'Received Payment',
    time: '25 May',
    color: 'error',
  },
  {
    img: avatar3,
    title: 'Received Order 📦',
    subtitle: 'New order received from john',
    time: '19 Mar',
  },
]
</script>

<template>
  <Notifications :notifications="notifications" />
</template>
