/**
 * @fileoverview Web Vitals reporting functionality for performance monitoring
 * Implements performance metric collection and reporting using web-vitals library
 */

import { ReportHandler } from 'web-vitals';

/**
 * Reports Core Web Vitals metrics to a specified handler function
 * Collects CLS, FID, FCP, LCP, and TTFB metrics
 * 
 * @param onPerfEntry - Optional callback function to handle performance metrics
 */
const reportWebVitals = (onPerfEntry?: ReportHandler) => {
  if (onPerfEntry && onPerfEntry instanceof Function) {
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      getCLS(onPerfEntry);  // Cumulative Layout Shift
      getFID(onPerfEntry);  // First Input Delay
      getFCP(onPerfEntry);  // First Contentful Paint
      getLCP(onPerfEntry);  // Largest Contentful Paint
      getTTFB(onPerfEntry); // Time to First Byte
    });
  }
};

export default reportWebVitals;
