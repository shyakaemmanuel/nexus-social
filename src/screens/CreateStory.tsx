import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreateStoryModal } from '../components/CreateStoryModal';

export default function CreateStory() {
  const navigate = useNavigate();
  const [editStory, setEditStory] = useState(null);

  const handleClose = () => {
    navigate(-1);
  };

  return (
    <CreateStoryModal 
      isOpen={true} 
      onClose={handleClose}
      editStory={editStory}
    />
  );
}
