const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

// Create icon.png (160x160)
function createIcon() {
  const canvas = createCanvas(160, 160);
  const ctx = canvas.getContext('2d');

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, 160, 160);
  gradient.addColorStop(0, '#4F46E5');
  gradient.addColorStop(1, '#7C3AED');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 160, 160);

  // Robot face
  ctx.fillStyle = '#FFFFFF';
  
  // Head
  ctx.beginPath();
  ctx.arc(80, 70, 40, 0, Math.PI * 2);
  ctx.fill();
  
  // Eyes
  ctx.fillStyle = '#4F46E5';
  ctx.beginPath();
  ctx.arc(65, 65, 8, 0, Math.PI * 2);
  ctx.arc(95, 65, 8, 0, Math.PI * 2);
  ctx.fill();
  
  // Mouth (smile)
  ctx.strokeStyle = '#4F46E5';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(80, 75, 15, 0.2 * Math.PI, 0.8 * Math.PI);
  ctx.stroke();
  
  // Antenna
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(80, 30);
  ctx.lineTo(80, 15);
  ctx.stroke();
  
  // Antenna ball
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(80, 10, 6, 0, Math.PI * 2);
  ctx.fill();

  // Save
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(__dirname, '../public/icon.png'), buffer);
  console.log('✓ Created icon.png (160x160)');
}

// Create preview.png (1024x768)
function createPreview() {
  const canvas = createCanvas(1024, 768);
  const ctx = canvas.getContext('2d');

  // Background
  const gradient = ctx.createLinearGradient(0, 0, 1024, 768);
  gradient.addColorStop(0, '#F3F4F6');
  gradient.addColorStop(1, '#E5E7EB');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1024, 768);

  // Title
  ctx.fillStyle = '#1F2937';
  ctx.font = 'bold 48px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('AI Assistant for SiYuan', 512, 120);
  
  // Subtitle
  ctx.fillStyle = '#6B7280';
  ctx.font = '28px Arial';
  ctx.fillText('智能助手插件', 512, 170);

  // Feature boxes
  const features = [
    { icon: '✨', title: 'Polish', desc: 'Text polishing' },
    { icon: '🌐', title: 'Translate', desc: 'Translation' },
    { icon: '📝', title: 'Summarize', desc: 'Summarization' },
    { icon: '📖', title: 'Expand', desc: 'Text expansion' }
  ];

  const boxWidth = 200;
  const boxHeight = 150;
  const startX = 112;
  const gap = 40;

  features.forEach((feature, index) => {
    const x = startX + index * (boxWidth + gap);
    const y = 300;

    // Box background
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    ctx.fillRect(x, y, boxWidth, boxHeight);
    ctx.shadowColor = 'transparent';

    // Icon
    ctx.font = '40px Arial';
    ctx.fillStyle = '#4F46E5';
    ctx.textAlign = 'center';
    ctx.fillText(feature.icon, x + boxWidth / 2, y + 60);

    // Title
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = '#1F2937';
    ctx.fillText(feature.title, x + boxWidth / 2, y + 100);

    // Description
    ctx.font = '14px Arial';
    ctx.fillStyle = '#6B7280';
    ctx.fillText(feature.desc, x + boxWidth / 2, y + 125);
  });

  // AI Providers
  ctx.font = 'bold 24px Arial';
  ctx.fillStyle = '#1F2937';
  ctx.textAlign = 'center';
  ctx.fillText('Supported AI Providers', 512, 520);

  const providers = ['OpenAI', 'Ollama', 'DeepSeek', 'Moonshot'];
  ctx.font = '18px Arial';
  ctx.fillStyle = '#6B7280';
  providers.forEach((provider, index) => {
    ctx.fillText(provider, 250 + index * 180, 570);
  });

  // Save
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(__dirname, '../public/preview.png'), buffer);
  console.log('✓ Created preview.png (1024x768)');
}

// Run
createIcon();
createPreview();
console.log('\nDone! Images created in public/ folder.');
