'use client';

import { useState } from 'react';

export default function DevTestPage() {
  const [formData, setFormData] = useState({
    requesterName: '',
    trackName: '',
    artistName: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage('');

    try {
      // Create a mock request first
      const requestResponse = await fetch('/api/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          track_name: formData.trackName,
          artist_name: formData.artistName,
          requester_nickname: formData.requesterName,
          track_uri: `spotify:track:dev-test-${Date.now()}`, // Generate fake URI
          album_name: 'Test Album',
          duration_ms: 180000 // 3 minutes
        })
      });

      if (requestResponse.ok) {
        const requestData = await requestResponse.json();
        setMessage(`✅ Request created with ID: ${requestData.id}`);

        // Now auto-approve it to add to queue
        setTimeout(async () => {
          try {
            const approveResponse = await fetch(`/api/admin/approve/${requestData.id}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer dev-test' // Mock auth for dev
              },
              body: JSON.stringify({
                add_to_queue: true,
                add_to_playlist: false
              })
            });

            if (approveResponse.ok) {
              setMessage(`🎉 Song approved and added to queue! Check the display screen for balloon animation.`);
              
              // Clear form
              setFormData({
                requesterName: '',
                trackName: '',
                artistName: ''
              });
            } else {
              setMessage(`⚠️ Request created but approval failed. You can manually approve it from the admin panel.`);
            }
          } catch (error) {
            console.error('Approval error:', error);
            setMessage(`⚠️ Request created but auto-approval failed. Check admin panel.`);
          }
        }, 1000);

      } else {
        const errorData = await requestResponse.json();
        setMessage(`❌ Error: ${errorData.error || 'Failed to create request'}`);
      }
    } catch (error) {
      console.error('Submit error:', error);
      setMessage('❌ Network error occurred');
    }

    setIsSubmitting(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const quickTestButtons = [
    { name: 'TestUser1', track: 'Bohemian Rhapsody', artist: 'Queen' },
    { name: 'TestUser2', track: 'Stairway to Heaven', artist: 'Led Zeppelin' },
    { name: 'TestUser3', track: 'Hotel California', artist: 'Eagles' },
    { name: 'TestUser4', track: 'Sweet Child O Mine', artist: 'Guns N Roses' }
  ];

  const fillQuickTest = (data: typeof quickTestButtons[0]) => {
    setFormData({
      requesterName: data.name,
      trackName: data.track,
      artistName: data.artist
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white p-6">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">🧪 Dev Test Page</h1>
          <p className="text-gray-300">
            Manually add songs to test the balloon pop animation on the display screen
          </p>
        </div>

        {/* Quick Test Buttons */}
        <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">🚀 Quick Test Data</h2>
          <div className="grid grid-cols-2 gap-3">
            {quickTestButtons.map((data, index) => (
              <button
                key={index}
                onClick={() => fillQuickTest(data)}
                className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
              >
                {data.name}: {data.track}
              </button>
            ))}
          </div>
        </div>

        {/* Manual Form */}
        <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">📝 Manual Song Entry</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="requesterName" className="block text-sm font-medium text-gray-300 mb-2">
                Requester Name *
              </label>
              <input
                type="text"
                id="requesterName"
                name="requesterName"
                value={formData.requesterName}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Enter your name"
              />
            </div>

            <div>
              <label htmlFor="trackName" className="block text-sm font-medium text-gray-300 mb-2">
                Track Name *
              </label>
              <input
                type="text"
                id="trackName"
                name="trackName"
                value={formData.trackName}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Enter track name"
              />
            </div>

            <div>
              <label htmlFor="artistName" className="block text-sm font-medium text-gray-300 mb-2">
                Artist Name *
              </label>
              <input
                type="text"
                id="artistName"
                name="artistName"
                value={formData.artistName}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Enter artist name"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:scale-100"
            >
              {isSubmitting ? '🔄 Adding to Queue...' : '🎵 Add to Queue & Test Animation'}
            </button>
          </form>

          {message && (
            <div className={`mt-4 p-4 rounded-lg ${
              message.includes('❌') 
                ? 'bg-red-900/50 border border-red-500/50 text-red-200' 
                : message.includes('⚠️')
                ? 'bg-yellow-900/50 border border-yellow-500/50 text-yellow-200'
                : 'bg-green-900/50 border border-green-500/50 text-green-200'
            }`}>
              {message}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-4">📋 How to Test</h2>
          <ol className="list-decimal list-inside space-y-2 text-gray-300">
            <li>Open the <strong>Display Screen</strong> in another tab: <code className="bg-gray-800 px-2 py-1 rounded">/display</code></li>
            <li>Fill in the form above or use a quick test button</li>
            <li>Click "Add to Queue & Test Animation"</li>
            <li>Watch the display screen - the requester badge should do a balloon pop animation! 🎈</li>
            <li>The animation should: expand 5x → turn green → pop at 6x → bounce back to normal</li>
          </ol>
          
          <div className="mt-4 p-4 bg-blue-900/50 border border-blue-500/50 rounded-lg">
            <p className="text-blue-200">
              <strong>💡 Tip:</strong> Keep the display screen open and visible while testing. 
              The animation happens immediately when the song is added to the queue!
            </p>
          </div>
        </div>

        {/* Quick Links */}
        <div className="mt-6 text-center space-x-4">
          <a 
            href="/display" 
            target="_blank"
            className="inline-block bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            🖥️ Open Display Screen
          </a>
          <a 
            href="/admin" 
            target="_blank"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            ⚙️ Open Admin Panel
          </a>
          <a 
            href="/" 
            className="inline-block bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            🏠 Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}
