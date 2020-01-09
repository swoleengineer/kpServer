const axios = require('axios');
const parseString = require('xml2js').parseString;

// open Library

const getBookdata = (isbn = '', format = 'json', jscmd = 'data') => {
  const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn.trim()}&format=${format}&jscmd=${jscmd}`;
  return new Promise((resolve, reject) => {
    if (!isbn || !isbn.length) {
      return reject({ mesage: 'Invalid function' });
    }
    console.log('About to request for open library info');
    return axios.get(url).then(
      res => {
        console.log('response open library - ', res.data, res);
        return resolve({ data: res.data[`ISBN:${isbn}`] || { message: 'NO DATA'} });
      },
      err => {
        console.log(err);
        return reject(err);
      }
    );
  });
}

// good Reads
const grKey = process.env.GOODREADS_KEY;
const grUrl = isbn => console.log('about to get good Reads info') || `https://www.goodreads.com/book/isbn/${isbn}?format=xml&key=${grKey}`;
const processBook = liv => {
  console.log(liv);
  const { id: [id], title: [title], description: [description], image_url: [image_001], authors = [], reviews_widget: [reviews_widget], similar_books = [] } = liv;
  const writers = (authors || []).map((author) => {
  
    const { id: [authorId = ''] = [], name: [authorName = ''], image_url: [authorPicture = ''], link: [link = '']} = author;
    const { ['-']: url = '', '$': info = {} } = authorPicture;
    const authorBody = { authorId, authorName, reviews_widget };
    const { nophoto = 'false' } = info;
    if (nophoto === 'false') {
      authorBody['authorPicture'] = url;
    };
    if (link && link.length) {
      authorBody['link'] = link;
    }
    return authorBody;
  });
  const suggestedBooks = similar_books.map((similarBook) => {
    const { title: [similarBookTitle = ''], image_url: [similarBookImage], isbn: [similarBookIsbn], authors: similarBookAuthors = [] } = similarBook;
    const sbookProcessedAuthors = similarBookAuthors.map((sba) => {
      const { id: [sbaId], name: [sbaName] } = sba;
      return { id: sbaId, name: sbaName }
    }); 
    return {
      title: similarBookTitle,
      image: similarBookImage,
      isbn: similarBookIsbn,
      authors: sbookProcessedAuthors
    };
  });
  return {
    id, title, description,
    image: image_001,
    authors: writers,
    reviews_widget,
    suggestedBooks
  };
}
const processXml = ({ data: xml }) => parseString(xml, (err, result) => {
  if (err) {
    throw new Error(err);
  }
  const { GoodreadsResponse = {} } = result;
  const { book: [book] } = GoodreadsResponse;
  const data = processBook(book);
  return { data };
})

module.exports = {
  getGoodReadsData: isbn => axios.get(grUrl(isbn)).then(res => console.log(res.data, '<-- data from good reads') || processXml(res), err => Promise.reject(err)),
  openLibraryData: getBookdata
} 
