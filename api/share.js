export default function handler(req, res) {
  if (req.method === 'POST') {
    const { shopName, blindBoxItems } = req.body;
    
    // 生成唯一ID
    const shareId = generateShareId();
    
    // 保存到数据库（简化版）
    const shareData = {
      id: shareId,
      shopName,
      blindBoxItems,
      timestamp: Date.now()
    };
    
    // 返回子域名分享链接
    const shareUrl = `https://hamburg2303.asia/?share=${shareId}`;
    
    res.status(200).json({ 
      success: true, 
      shareUrl,
      shareId 
    });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

function generateShareId() {
  return 'share_' + Math.random().toString(36).substr(2, 9);
}
