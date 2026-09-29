// Persist each successful publication separately so a failed story can be retried
// without creating another feed post.
export async function publishBundle({ state, imageUrl, caption, previewStamp, stories, storyOnly, publish, persist }) {
  if (storyOnly) {
    if (!state.lastPublicationId || !state.lastPreviewStamp) {
      throw new Error('Aucun post enregistré à accompagner en story. Utiliser npm run publish-existing pour publier la photo et sa story.');
    }
    if (state.lastStoryForPost === state.lastPublicationId) return;
  } else {
    const post = await publish(imageUrl, caption, false);
    if (!post.id) throw new Error('Instagram n’a pas renvoyé d’identifiant de publication. Vérifier le compte avant de relancer.');
    state.lastPublishedAt = new Date().toISOString();
    state.lastPublicationId = post.id;
    state.lastPreviewStamp = previewStamp;
    await persist(state);
  }

  if (stories || storyOnly) {
    try {
      const story = await publish(imageUrl, undefined, true);
      if (!story.id) throw new Error('Identifiant de story absent. Vérifier le compte avant de relancer.');
      state.lastStoryId = story.id;
      state.lastStoryForPost = state.lastPublicationId;
      state.lastStoryPublishedAt = new Date().toISOString();
      await persist(state);
    } catch (error) {
      throw new Error(`Le post ${state.lastPublicationId} est enregistré, mais la story n’a pas été confirmée : ${error.message}. Après vérification sur Instagram, relancer uniquement avec npm run publish-story-existing.`);
    }
  }
}
