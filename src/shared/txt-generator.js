function generateTenderTxt(record) {
  if (!record || typeof record !== 'object') return '';

  var lines = [];
  lines.push('=== Tender Details ===');
  lines.push('');
  lines.push('Tender ID: ' + (typeof record.tenderId === 'string' ? record.tenderId : 'N/A'));
  lines.push('Title: ' + (typeof record.title === 'string' && record.title !== 'Not available' ? record.title : 'N/A'));
  lines.push('Category: ' + (typeof record.category === 'string' && record.category !== 'Not available' ? record.category : 'N/A'));
  lines.push('Province: ' + (typeof record.province === 'string' && record.province !== 'Not available' ? record.province : 'N/A'));
  lines.push('Location: ' + (typeof record.location === 'string' && record.location !== 'Not available' ? record.location : 'N/A'));
  lines.push('Subcategory: ' + (typeof record.subcategory === 'string' && record.subcategory !== 'Not available' ? record.subcategory : 'N/A'));
  lines.push('Sector: ' + (typeof record.sector === 'string' && record.sector !== 'Not available' ? record.sector : 'N/A'));
  lines.push('Newspaper: ' + (typeof record.newspaper === 'string' && record.newspaper !== 'Not available' ? record.newspaper : 'N/A'));
  lines.push('Last Date: ' + (typeof record.lastDate === 'string' && record.lastDate !== 'Not available' ? record.lastDate : 'N/A'));
  lines.push('Date Posted: ' + (typeof record.datePosted === 'string' && record.datePosted !== 'Not available' ? record.datePosted : 'N/A'));
  lines.push('');
  lines.push('Description:');
  lines.push(typeof record.description === 'string' && record.description !== 'Not available' ? record.description : 'N/A');
  lines.push('');
  lines.push('URL: ' + (typeof record.detailUrl === 'string' ? record.detailUrl : 'N/A'));
  lines.push('');

  if (Array.isArray(record.imageUrls) && record.imageUrls.length > 0) {
    lines.push('Images:');
    for (var i = 0; i < record.imageUrls.length; i++) {
      lines.push('  ' + (i + 1) + '. ' + record.imageUrls[i]);
    }
    lines.push('');
  }

  return lines.join('\r\n');
}
