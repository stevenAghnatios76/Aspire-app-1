-- ============================================================
-- Seed Data: 20 Sample Books
-- Run this in the Supabase SQL Editor after the migration
-- ============================================================

INSERT INTO public.books (title, author, isbn, genre, description, cover_url, published_year, total_copies, available_copies, status) VALUES

('To Kill a Mockingbird', 'Harper Lee', '978-0-06-112008-4', 'Fiction',
 'A novel about the serious issues of rape and racial inequality narrated by young Scout Finch in 1930s Alabama.',
 'https://covers.openlibrary.org/b/isbn/9780061120084-L.jpg', 1960, 3, 3, 'available'),

('1984', 'George Orwell', '978-0-45-152493-5', 'Dystopian',
 'A dystopian novel set in a totalitarian society ruled by Big Brother, exploring themes of surveillance, propaganda, and individual freedom.',
 'https://covers.openlibrary.org/b/isbn/9780451524935-L.jpg', 1949, 2, 2, 'available'),

('The Great Gatsby', 'F. Scott Fitzgerald', '978-0-74-327356-5', 'Classic',
 'A story of the mysteriously wealthy Jay Gatsby and his love for the beautiful Daisy Buchanan in the Jazz Age.',
 'https://covers.openlibrary.org/b/isbn/9780743273565-L.jpg', 1925, 2, 2, 'available'),

('Pride and Prejudice', 'Jane Austen', '978-0-14-143951-8', 'Romance',
 'A romantic novel following Elizabeth Bennet as she navigates issues of manners, upbringing, morality, and marriage in early 19th-century England.',
 'https://covers.openlibrary.org/b/isbn/9780141439518-L.jpg', 1813, 3, 3, 'available'),

('The Catcher in the Rye', 'J.D. Salinger', '978-0-31-676948-0', 'Fiction',
 'The story of teenager Holden Caulfield and his experiences in New York City after being expelled from prep school.',
 'https://covers.openlibrary.org/b/isbn/9780316769488-L.jpg', 1951, 2, 2, 'available'),

('The Hobbit', 'J.R.R. Tolkien', '978-0-54-792822-7', 'Fantasy',
 'Bilbo Baggins, a comfortable hobbit, is swept into an epic quest to reclaim the dwarves homeland from the dragon Smaug.',
 'https://covers.openlibrary.org/b/isbn/9780547928227-L.jpg', 1937, 3, 3, 'available'),

('Fahrenheit 451', 'Ray Bradbury', '978-1-45-167331-8', 'Science Fiction',
 'In a future American society where books are outlawed, fireman Guy Montag begins to question his role in destroying knowledge.',
 'https://covers.openlibrary.org/b/isbn/9781451673319-L.jpg', 1953, 2, 2, 'available'),

('Brave New World', 'Aldous Huxley', '978-0-06-085052-4', 'Dystopian',
 'A futuristic World State where citizens are genetically modified and conditioned to be productive and happy consumers.',
 'https://covers.openlibrary.org/b/isbn/9780060850524-L.jpg', 1932, 2, 2, 'available'),

('The Lord of the Rings', 'J.R.R. Tolkien', '978-0-54-492822-7', 'Fantasy',
 'An epic high-fantasy novel following hobbits Frodo and Sam on their quest to destroy the One Ring and defeat the Dark Lord Sauron.',
 'https://covers.openlibrary.org/b/isbn/9780544928220-L.jpg', 1954, 2, 2, 'available'),

('Jane Eyre', 'Charlotte Brontë', '978-0-14-144114-6', 'Classic',
 'An orphaned girl grows into a strong, independent woman and governess who falls in love with her mysterious employer, Mr. Rochester.',
 'https://covers.openlibrary.org/b/isbn/9780141441146-L.jpg', 1847, 2, 2, 'available'),

('Dune', 'Frank Herbert', '978-0-44-117271-9', 'Science Fiction',
 'Set in the distant future, the story follows Paul Atreides as his family takes control of the desert planet Arrakis, the only source of the most valuable substance in the universe.',
 'https://covers.openlibrary.org/b/isbn/9780441172719-L.jpg', 1965, 3, 3, 'available'),

('The Alchemist', 'Paulo Coelho', '978-0-06-112241-5', 'Fiction',
 'A young Andalusian shepherd named Santiago travels from Spain to Egypt in search of a treasure buried at the Pyramids.',
 'https://covers.openlibrary.org/b/isbn/9780061122415-L.jpg', 1988, 2, 2, 'available'),

('One Hundred Years of Solitude', 'Gabriel García Márquez', '978-0-06-088328-7', 'Magical Realism',
 'The multi-generational story of the Buendía family in the mythical town of Macondo, blending reality with fantastical elements.',
 'https://covers.openlibrary.org/b/isbn/9780060883287-L.jpg', 1967, 2, 2, 'available'),

('The Hitchhiker''s Guide to the Galaxy', 'Douglas Adams', '978-0-34-539180-3', 'Science Fiction',
 'Arthur Dent is rescued from Earth''s demolition by his alien friend Ford Prefect, beginning an absurd journey through the galaxy.',
 'https://covers.openlibrary.org/b/isbn/9780345391803-L.jpg', 1979, 3, 3, 'available'),

('Crime and Punishment', 'Fyodor Dostoevsky', '978-0-14-044913-6', 'Classic',
 'A poor St. Petersburg student Raskolnikov commits murder, convinced his intelligence places him above moral law, then struggles with guilt.',
 'https://covers.openlibrary.org/b/isbn/9780140449136-L.jpg', 1866, 2, 2, 'available'),

('The Picture of Dorian Gray', 'Oscar Wilde', '978-0-14-143957-0', 'Gothic',
 'A young man sells his soul for eternal youth and beauty while his portrait ages and records his sins.',
 'https://covers.openlibrary.org/b/isbn/9780141439570-L.jpg', 1890, 2, 2, 'available'),

('Sapiens: A Brief History of Humankind', 'Yuval Noah Harari', '978-0-06-231609-7', 'Non-Fiction',
 'An exploration of how Homo sapiens came to dominate the world, covering the Cognitive, Agricultural, and Scientific Revolutions.',
 'https://covers.openlibrary.org/b/isbn/9780062316097-L.jpg', 2011, 3, 3, 'available'),

('The Handmaid''s Tale', 'Margaret Atwood', '978-0-38-549081-8', 'Dystopian',
 'In the Republic of Gilead, a theocratic totalitarian state, women called Handmaids are forced into reproductive servitude.',
 'https://covers.openlibrary.org/b/isbn/9780385490818-L.jpg', 1985, 2, 2, 'available'),

('Educated', 'Tara Westover', '978-0-39-959050-4', 'Memoir',
 'A memoir of a woman who grew up in a survivalist family in Idaho and eventually earned a PhD from Cambridge University.',
 'https://covers.openlibrary.org/b/isbn/9780399590504-L.jpg', 2018, 2, 2, 'available'),

('Project Hail Mary', 'Andy Weir', '978-0-59-313562-9', 'Science Fiction',
 'An astronaut wakes up alone on a spaceship with no memory and must figure out how to save Earth from an extinction-level threat.',
 'https://covers.openlibrary.org/b/isbn/9780593135624-L.jpg', 2021, 3, 3, 'available');
