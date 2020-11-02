package com.zufar.bookshelf.dao.book.model;

import com.zufar.bookshelf.dao.AbstractAuditingEntity;
import com.zufar.bookshelf.dao.author.model.Author;
import com.zufar.bookshelf.dao.country.model.Country;
import lombok.*;
import org.springframework.format.annotation.DateTimeFormat;

import javax.persistence.*;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Setter
@Getter
@Entity
@Table(name = "books")
public class Book extends AbstractAuditingEntity {

    @Id
    @GeneratedValue
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(name = "image_link")
    private String imageLink;

    @Column(name = "epub_link")
    private String epubLink;

    @Column(name = "fb2_link")
    private String fb2Link;

    @Column(name = "pdf_link")
    private String pdfLink;

    @ManyToMany(mappedBy = "books", fetch = FetchType.EAGER)
    private List<Author> authors;

    @Column(name = "publication_date")
    @DateTimeFormat(pattern = "yyyy-MM-dd")
    private LocalDate publicationDate;

    @OneToOne
    @JoinColumn(name = "country_id")
    private Country country;

    @Column(name = "page_count")
    private int pageCount;

    public void update(Book book) {
        this.title = book.getTitle();
        this.imageLink = book.getImageLink();
        this.epubLink = book.getEpubLink();
        this.fb2Link = book.getFb2Link();
        this.pdfLink = book.getPdfLink();
        this.authors = book.getAuthors();
        this.publicationDate = book.getPublicationDate();
        this.country = book.getCountry();
        this.pageCount = book.getPageCount();
    }

    @Override
    public String toString() {
        List<String> authorNames = new ArrayList<>();
        if (this.authors != null) {
            authors.forEach(author -> authorNames.add(author.getFullName()));
        }
        return "Book{" +
                "id=" + id +
                ", title='" + title + '\'' +
                ", imageLink='" + imageLink + '\'' +
                ", epubLink='" + epubLink + '\'' +
                ", fb2Link='" + fb2Link + '\'' +
                ", pdfLink='" + pdfLink + '\'' +
                ", authors=" + authorNames +
                ", publicationDate=" + publicationDate +
                ", country=" + country +
                ", pageCount=" + pageCount +
                '}';
    }
}
