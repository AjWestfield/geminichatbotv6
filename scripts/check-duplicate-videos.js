#!/usr/bin/env node

// Script to check for duplicate videos in the app
// Run this from the project root: node scripts/check-duplicate-videos.js

const fs = require('fs');
const path = require('path');

// Function to check localStorage data (you'll need to copy this from browser console)
function checkLocalStorageVideos() {
  console.log('\n=== Checking for Duplicate Videos ===\n');
  
  // This data should be copied from browser console:
  // Run in browser console: localStorage.getItem('gemini-chat-videos')
  const localStorageData = process.env.VIDEO_DATA || '[]';
  
  try {
    const videos = JSON.parse(localStorageData);
    console.log(`Total videos found: ${videos.length}`);
    
    // Check for duplicates
    const idCounts = {};
    const duplicates = [];
    
    videos.forEach(video => {
      if (idCounts[video.id]) {
        idCounts[video.id]++;
        duplicates.push(video);
      } else {
        idCounts[video.id] = 1;
      }
    });
    
    if (duplicates.length > 0) {
      console.log('\n❌ DUPLICATE VIDEOS FOUND:');
      Object.entries(idCounts).forEach(([id, count]) => {
        if (count > 1) {
          console.log(`  - Video ID "${id}" appears ${count} times`);
        }
      });
      
      console.log('\nDuplicate video details:');
      duplicates.forEach(video => {
        console.log(`  - ID: ${video.id}, Status: ${video.status}, Prompt: ${video.prompt?.substring(0, 50)}...`);
      });
    } else {
      console.log('\n✅ No duplicate videos found!');
    }
    
    // Check for videos with missing data
    console.log('\n=== Checking Video Data Integrity ===\n');
    const issues = [];
    
    videos.forEach((video, index) => {
      const videoIssues = [];
      
      if (!video.id) videoIssues.push('Missing ID');
      if (!video.status) videoIssues.push('Missing status');
      if (video.status === 'completed' && !video.url) videoIssues.push('Completed but no URL');
      if (!video.prompt) videoIssues.push('Missing prompt');
      
      if (videoIssues.length > 0) {
        issues.push({
          index,
          id: video.id || 'NO_ID',
          issues: videoIssues
        });
      }
    });
    
    if (issues.length > 0) {
      console.log('❌ Videos with data issues:');
      issues.forEach(({ index, id, issues }) => {
        console.log(`  - Video at index ${index} (ID: ${id}):`);
        issues.forEach(issue => console.log(`    • ${issue}`));
      });
    } else {
      console.log('✅ All videos have complete data!');
    }
    
  } catch (error) {
    console.error('Error parsing video data:', error);
  }
}

// Instructions for usage
console.log('=== Video Duplicate Checker ===\n');
console.log('To check for duplicate videos:');
console.log('1. Open your app in the browser');
console.log('2. Open browser console (F12)');
console.log('3. Run: localStorage.getItem("gemini-chat-videos")');
console.log('4. Copy the result');
console.log('5. Run this script with: VIDEO_DATA=\'<paste_data_here>\' node scripts/check-duplicate-videos.js\n');

// If VIDEO_DATA is provided, run the check
if (process.env.VIDEO_DATA) {
  checkLocalStorageVideos();
}
